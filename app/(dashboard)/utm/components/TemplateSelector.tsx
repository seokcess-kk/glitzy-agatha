'use client'

import { useState } from 'react'
import { ChevronDown, Save, Trash2, Star } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

export interface UtmTemplate {
  id: number
  client_id: number
  name: string
  base_url: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null
  platform: string | null
  is_default: boolean
  created_at: string
}

export interface TemplateFormData {
  baseUrl: string
  source: string
  medium: string
  campaign: string
  content: string
  term: string
  platform: string
}

interface TemplateSelectorProps {
  templates: UtmTemplate[]
  selectedTemplateId: number | null
  currentFormData: TemplateFormData
  onSelectTemplate: (template: UtmTemplate) => void
  onSaveTemplate: (name: string, isDefault: boolean) => Promise<void>
  onDeleteTemplate: (id: number) => Promise<void>
  onRefresh: () => void
  disabled?: boolean
}

export function TemplateSelector({
  templates,
  selectedTemplateId,
  currentFormData,
  onSelectTemplate,
  onSaveTemplate,
  onDeleteTemplate,
  onRefresh,
  disabled,
}: TemplateSelectorProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
  const [templateName, setTemplateName] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId)
  const deleteTarget = templates.find(t => t.id === deleteTargetId)

  async function handleSave() {
    if (!templateName.trim()) {
      toast.error('템플릿 이름을 입력하세요.')
      return
    }

    setSaving(true)
    try {
      await onSaveTemplate(templateName.trim(), isDefault)
      setSaveDialogOpen(false)
      setTemplateName('')
      setIsDefault(false)
      onRefresh()
    } catch (err) {
      toast.error('템플릿 저장 실패')
    } finally {
      setSaving(false)
    }
  }

  function openDeleteDialog(id: number, e: React.MouseEvent) {
    e.stopPropagation()
    setDeleteTargetId(id)
    setDeleteDialogOpen(true)
  }

  async function handleConfirmDelete() {
    if (!deleteTargetId) return

    setDeleting(true)
    try {
      await onDeleteTemplate(deleteTargetId)
      onRefresh()
      setDeleteDialogOpen(false)
      setDeleteTargetId(null)
    } catch (err) {
      toast.error('템플릿 삭제 실패')
    } finally {
      setDeleting(false)
    }
  }

  const hasFormData = currentFormData.source || currentFormData.campaign

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-[200px] justify-between" disabled={disabled}>
            {selectedTemplate ? selectedTemplate.name : '템플릿 선택'}
            <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[200px]">
          {templates.length === 0 ? (
            <div className="px-2 py-3 text-xs text-muted-foreground text-center">
              저장된 템플릿이 없습니다.
            </div>
          ) : (
            templates.map(template => (
              <DropdownMenuItem
                key={template.id}
                onClick={() => onSelectTemplate(template)}
                className="flex items-center justify-between"
              >
                <span className="flex items-center gap-1.5 truncate">
                  {template.is_default && <Star className="h-3 w-3 text-yellow-500" />}
                  {template.name}
                </span>
                <button
                  onClick={(e) => openDeleteDialog(template.id, e)}
                  className="text-muted-foreground hover:text-red-400 p-1"
                  disabled={deleting}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </DropdownMenuItem>
            ))
          )}
          {templates.length > 0 && <DropdownMenuSeparator />}
          <DropdownMenuItem
            onClick={() => setSaveDialogOpen(true)}
            disabled={!hasFormData}
            className="text-brand-400"
          >
            <Save className="mr-2 h-4 w-4" />
            현재 설정을 템플릿으로 저장
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {hasFormData && (
        <Button
          variant="glass"
          size="sm"
          onClick={() => setSaveDialogOpen(true)}
          title="템플릿으로 저장"
        >
          <Save className="h-4 w-4" />
        </Button>
      )}

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>템플릿으로 저장</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">템플릿 이름</label>
              <Input
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                placeholder="예: Meta 봄 캠페인"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is-default"
                checked={isDefault}
                onChange={e => setIsDefault(e.target.checked)}
                className="rounded border-border"
              />
              <label htmlFor="is-default" className="text-sm text-muted-foreground">
                기본 템플릿으로 설정
              </label>
            </div>
            <div className="text-xs text-muted-foreground bg-muted rounded-lg p-3">
              <p className="font-medium mb-2">저장될 설정:</p>
              <ul className="space-y-1">
                {currentFormData.baseUrl && <li>URL: {currentFormData.baseUrl}</li>}
                {currentFormData.source && <li>source: {currentFormData.source}</li>}
                {currentFormData.medium && <li>medium: {currentFormData.medium}</li>}
                {currentFormData.campaign && <li>campaign: {currentFormData.campaign}</li>}
                {currentFormData.content && <li>content: {currentFormData.content}</li>}
                {currentFormData.term && <li>term: {currentFormData.term}</li>}
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>템플릿 삭제</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              <span className="text-foreground font-medium">{deleteTarget?.name}</span> 템플릿을 삭제하시겠습니까?
            </p>
            <p className="text-xs text-muted-foreground mt-2">이 작업은 되돌릴 수 없습니다.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              취소
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleting}>
              {deleting ? '삭제 중...' : '삭제'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
