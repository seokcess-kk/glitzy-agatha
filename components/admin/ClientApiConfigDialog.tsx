'use client'

import { useState, useEffect, useCallback } from 'react'
import { Eye, EyeOff, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { formatDateTime } from '@/lib/date'
import {
  API_CONFIG_PLATFORMS, API_PLATFORM_LABELS, API_PLATFORM_FIELDS,
  SYNC_ENABLED_PLATFORMS, type ApiPlatform,
} from '@/lib/platform'

interface Props {
  clientId: number
  clientName: string
  open: boolean
  onClose: () => void
  onUpdated?: () => void
}

type Platform = ApiPlatform

interface PlatformConfig {
  config: Record<string, string> | null
  is_active: boolean
  last_tested_at: string | null
  last_test_result: string | null
}

interface TestResultState {
  loading: boolean
  success: boolean | null
  message: string
}

const PLATFORM_LABELS = API_PLATFORM_LABELS
const PLATFORM_FIELDS = API_PLATFORM_FIELDS

const EMPTY_CONFIG: PlatformConfig = {
  config: null,
  is_active: false,
  last_tested_at: null,
  last_test_result: null,
}

function isMaskedValue(value: string): boolean {
  return value.startsWith('****')
}

export default function ClientApiConfigDialog({ clientId, clientName, open, onClose, onUpdated }: Props) {
  const initConfigs = () => Object.fromEntries(API_CONFIG_PLATFORMS.map(p => [p, { ...EMPTY_CONFIG }])) as Record<Platform, PlatformConfig>
  const initFormValues = () => Object.fromEntries(API_CONFIG_PLATFORMS.map(p => [p, {}])) as Record<Platform, Record<string, string>>
  const initTestResults = () => Object.fromEntries(API_CONFIG_PLATFORMS.map(p => [p, { loading: false, success: null, message: '' }])) as Record<Platform, TestResultState>

  const [configs, setConfigs] = useState<Record<Platform, PlatformConfig>>(initConfigs)
  const [formValues, setFormValues] = useState<Record<Platform, Record<string, string>>>(initFormValues)
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<Platform | null>(null)
  const [deleting, setDeleting] = useState<Platform | null>(null)
  const [testResults, setTestResults] = useState<Record<Platform, TestResultState>>(initTestResults)
  const [activeTab, setActiveTab] = useState<Platform>('meta_ads')

  const fetchConfigs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/api-configs`)
      if (!res.ok) throw new Error('조회 실패')
      const data = await res.json()
      const items: Array<{
        platform: Platform
        config: Record<string, string> | null
        is_active: boolean
        last_tested_at: string | null
        last_test_result: string | null
      }> = Array.isArray(data) ? data : (data.data || [])

      const newConfigs = initConfigs()
      const newFormValues = initFormValues()

      for (const item of items) {
        if (item.platform in newConfigs) {
          newConfigs[item.platform] = {
            config: item.config,
            is_active: item.is_active,
            last_tested_at: item.last_tested_at,
            last_test_result: item.last_test_result,
          }
          if (item.config) {
            const values: Record<string, string> = {}
            for (const [k, v] of Object.entries(item.config)) {
              values[k] = typeof v === 'string' ? v : String(v ?? '')
            }
            newFormValues[item.platform] = values
          }
        }
      }

      setConfigs(newConfigs)
      setFormValues(newFormValues)
      setTestResults(initTestResults())
    } catch {
      toast.error('API 설정 조회에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    if (open) {
      fetchConfigs()
      setVisibleFields({})
    }
  }, [open, fetchConfigs])

  const updateField = (platform: Platform, key: string, value: string) => {
    setFormValues(prev => ({
      ...prev,
      [platform]: { ...prev[platform], [key]: value },
    }))
  }

  const toggleVisibility = (fieldKey: string) => {
    setVisibleFields(prev => ({ ...prev, [fieldKey]: !prev[fieldKey] }))
  }

  const handleSave = async (platform: Platform) => {
    const values = formValues[platform]

    // 마스킹 값 제외, 실제 입력된 값만 전송
    const finalConfig: Record<string, string> = {}
    for (const field of PLATFORM_FIELDS[platform]) {
      const val = values[field.key] || ''
      if (val && !isMaskedValue(val)) {
        finalConfig[field.key] = val
      }
    }

    if (Object.keys(finalConfig).length === 0 && !configs[platform].config) {
      toast.error('최소 하나의 필드를 입력해주세요.')
      return
    }

    setSaving(platform)
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/api-configs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, config: finalConfig, is_active: configs[platform].is_active }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '저장 실패')
      }
      toast.success(`${PLATFORM_LABELS[platform]} API 설정이 저장되었습니다.`)
      await fetchConfigs()
      onUpdated?.()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '저장 실패'
      toast.error(message)
    } finally {
      setSaving(null)
    }
  }

  const handleTest = async (platform: Platform) => {
    setTestResults(prev => ({
      ...prev,
      [platform]: { loading: true, success: null, message: '' },
    }))

    try {
      const res = await fetch(`/api/admin/clients/${clientId}/api-configs/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      })
      const data = await res.json()
      const result = data.data || data

      if (result.success) {
        setTestResults(prev => ({
          ...prev,
          [platform]: {
            loading: false,
            success: true,
            message: result.accountName || '연결됨',
          },
        }))
        // Refresh to get updated last_tested_at
        await fetchConfigs()
        onUpdated?.()
      } else {
        setTestResults(prev => ({
          ...prev,
          [platform]: {
            loading: false,
            success: false,
            message: result.error || '연결 실패',
          },
        }))
      }
    } catch {
      setTestResults(prev => ({
        ...prev,
        [platform]: {
          loading: false,
          success: false,
          message: '연결 테스트 요청에 실패했습니다.',
        },
      }))
    }
  }

  const handleDelete = async (platform: Platform) => {
    if (!confirm(`${PLATFORM_LABELS[platform]} API 설정을 삭제하시겠습니까?`)) return

    setDeleting(platform)
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/api-configs`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '삭제 실패')
      }
      toast.success(`${PLATFORM_LABELS[platform]} API 설정이 삭제되었습니다.`)
      await fetchConfigs()
      onUpdated?.()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '삭제 실패'
      toast.error(message)
    } finally {
      setDeleting(null)
    }
  }

  const renderPlatformTab = (platform: Platform) => {
    const fields = PLATFORM_FIELDS[platform]
    const config = configs[platform]
    const values = formValues[platform]
    const testResult = testResults[platform]
    const hasExistingConfig = !!config.config
    const canTest = SYNC_ENABLED_PLATFORMS.includes(platform)

    return (
      <div className="space-y-4 p-4 md:p-5">
        {fields.map(field => {
          const visKey = `${platform}_${field.key}`
          const isVisible = visibleFields[visKey] || false
          const value = values[field.key] || ''
          const isMasked = isMaskedValue(value)

          return (
            <div key={field.key} className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{field.label}</Label>
              <div className="relative">
                <Input
                  type={isVisible ? 'text' : 'password'}
                  value={value}
                  onChange={e => updateField(platform, field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="pr-10"
                  onFocus={() => {
                    // Clear masked value on focus so user can type fresh
                    if (isMasked) {
                      updateField(platform, field.key, '')
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => toggleVisibility(visKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={isVisible ? '숨기기' : '보기'}
                >
                  {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )
        })}

        <div className="flex items-center justify-between pt-2">
          <Label className="text-xs text-muted-foreground">활성화</Label>
          <Switch
            checked={config.is_active}
            onCheckedChange={checked => {
              setConfigs(prev => ({
                ...prev,
                [platform]: { ...prev[platform], is_active: checked },
              }))
            }}
          />
        </div>

        {/* Test result area */}
        <div className="space-y-2 pt-2">
          {testResult.loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" />
              연결 테스트 중...
            </div>
          )}
          {!testResult.loading && testResult.success === true && (
            <p className="text-sm text-emerald-500">
              &#10003; 연결됨 &mdash; {testResult.message}
            </p>
          )}
          {!testResult.loading && testResult.success === false && (
            <p className="text-sm text-red-500">
              &#10007; 연결 실패 &mdash; {testResult.message}
            </p>
          )}
          {config.last_tested_at && (
            <p className="text-xs text-muted-foreground">
              마지막 테스트: {formatDateTime(config.last_tested_at)}
              {config.last_test_result === 'success' && (
                <span className="ml-2 text-emerald-500">성공</span>
              )}
              {config.last_test_result === 'failed' && (
                <span className="ml-2 text-red-500">실패</span>
              )}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-2">
          <Button
            onClick={() => handleTest(platform)}
            variant="outline"
            size="sm"
            disabled={!canTest || !hasExistingConfig || testResult.loading}
            title={!canTest ? '연결 테스트 준비 중' : undefined}
          >
            {testResult.loading ? (
              <><Loader2 size={14} className="animate-spin" /> 테스트 중</>
            ) : (
              '연결 테스트'
            )}
          </Button>
          <Button
            onClick={() => handleSave(platform)}
            size="sm"
            className="bg-brand-600 hover:bg-brand-700"
            disabled={saving === platform}
          >
            {saving === platform ? '저장 중...' : '저장'}
          </Button>
          {hasExistingConfig && (
            <Button
              onClick={() => handleDelete(platform)}
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-400 hover:bg-red-500/10 ml-auto"
              disabled={deleting === platform}
            >
              <Trash2 size={14} />
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={val => { if (!val) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{clientName} &mdash; API 설정</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={v => setActiveTab(v as Platform)}>
            <TabsList className="w-full overflow-x-auto">
              {API_CONFIG_PLATFORMS.map(p => (
                <TabsTrigger key={p} value={p} className="flex-1 text-xs min-w-0 px-2">
                  {PLATFORM_LABELS[p]}
                  {configs[p]?.config && (
                    <span
                      className={`ml-1 inline-block w-2 h-2 rounded-full ${
                        configs[p].last_test_result === 'success'
                          ? 'bg-emerald-500'
                          : configs[p].last_test_result === 'failed'
                            ? 'bg-red-500'
                            : 'bg-muted-foreground/40'
                      }`}
                    />
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {API_CONFIG_PLATFORMS.map(p => (
              <TabsContent key={p} value={p}>
                {renderPlatformTab(p)}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}
