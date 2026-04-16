'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useClient } from '@/components/ClientContext'

interface ManualLeadFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

const SOURCE_OPTIONS = [
  { value: 'phone', label: '전화 문의' },
  { value: 'visit', label: '방문 문의' },
  { value: 'referral', label: '소개/추천' },
  { value: 'other', label: '기타' },
]

export function ManualLeadForm({ open, onOpenChange, onSuccess }: ManualLeadFormProps) {
  const { selectedClientId } = useClient()
  const [name, setName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [source, setSource] = useState('')
  const [memo, setMemo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [phoneError, setPhoneError] = useState('')

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setName('')
      setPhoneNumber('')
      setSource('')
      setMemo('')
      setPhoneError('')
    }
    onOpenChange(isOpen)
  }

  const validatePhone = (value: string) => {
    const digits = value.replace(/[^0-9]/g, '')
    if (digits.length === 0) {
      setPhoneError('')
      return
    }
    if (!digits.startsWith('010')) {
      setPhoneError('010으로 시작해야 합니다.')
      return
    }
    if (digits.length !== 11) {
      setPhoneError('11자리 숫자를 입력해주세요.')
      return
    }
    setPhoneError('')
  }

  const handlePhoneChange = (value: string) => {
    // 자동 포맷팅: 010-1234-5678
    const digits = value.replace(/[^0-9]/g, '')
    let formatted = digits
    if (digits.length > 3 && digits.length <= 7) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`
    } else if (digits.length > 7) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`
    }
    setPhoneNumber(formatted)
    validatePhone(digits)
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('이름을 입력해주세요.')
      return
    }
    if (!phoneNumber) {
      toast.error('전화번호를 입력해주세요.')
      return
    }
    const digits = phoneNumber.replace(/[^0-9]/g, '')
    if (digits.length !== 11 || !digits.startsWith('010')) {
      toast.error('올바른 전화번호 형식이 아닙니다.')
      return
    }
    if (!source) {
      toast.error('유입 경로를 선택해주세요.')
      return
    }

    setSubmitting(true)
    try {
      const params = selectedClientId ? `?client_id=${selectedClientId}` : ''
      const res = await fetch(`/api/customers/leads${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone_number: phoneNumber,
          utm_source: source,
          memo: memo.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '등록에 실패했습니다.')

      if (data.is_revisit) {
        toast.success(`재유입으로 등록되었습니다. (기존: ${data.existing_contact_name})`)
      } else {
        toast.success('리드가 등록되었습니다.')
      }
      onOpenChange(false)
      onSuccess()
    } catch (e: any) {
      toast.error(e.message || '등록에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">수동 리드 등록</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            전화 문의, 방문 문의 등 수동으로 리드를 등록합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">
              이름 <span className="text-rose-500">*</span>
            </Label>
            <Input
              placeholder="이름"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={50}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">
              전화번호 <span className="text-rose-500">*</span>
            </Label>
            <Input
              placeholder="010-0000-0000"
              value={phoneNumber}
              onChange={e => handlePhoneChange(e.target.value)}
              maxLength={13}
            />
            {phoneError && (
              <p className="text-xs text-rose-500">{phoneError}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">
              유입 경로 <span className="text-rose-500">*</span>
            </Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger>
                <SelectValue placeholder="유입 경로 선택" />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">메모</Label>
            <Textarea
              placeholder="메모 입력 (선택)"
              value={memo}
              onChange={e => setMemo(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? '등록 중...' : '등록'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
