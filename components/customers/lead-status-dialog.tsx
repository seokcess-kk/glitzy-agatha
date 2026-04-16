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

interface LeadStatusDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  leadId: number
  leadName: string
  currentStatus: string
  onSuccess: () => void
}

const STATUS_OPTIONS = [
  { value: 'in_progress', label: '진행중' },
  { value: 'converted', label: '전환' },
  { value: 'lost', label: '미전환' },
  { value: 'hold', label: '보류' },
]

const LOST_REASONS = [
  { value: 'no_response', label: '응답 없음' },
  { value: 'not_interested', label: '관심 없음' },
  { value: 'price_issue', label: '가격 문제' },
  { value: 'chose_competitor', label: '경쟁사 선택' },
  { value: 'bad_timing', label: '시기 부적합' },
  { value: 'other', label: '기타' },
]

export function LeadStatusDialog({ open, onOpenChange, leadId, leadName, currentStatus, onSuccess }: LeadStatusDialogProps) {
  const [status, setStatus] = useState('')
  const [conversionValue, setConversionValue] = useState('')
  const [lostReason, setLostReason] = useState('')
  const [memo, setMemo] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setStatus('')
      setConversionValue('')
      setLostReason('')
      setMemo('')
    }
    onOpenChange(isOpen)
  }

  const handleSubmit = async () => {
    if (!status) {
      toast.error('상태를 선택해주세요.')
      return
    }
    if (status === 'converted' && !conversionValue) {
      toast.error('전환 금액을 입력해주세요.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/customers/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          conversion_value: status === 'converted' ? Number(conversionValue) : undefined,
          lost_reason: status === 'lost' ? lostReason : undefined,
          conversion_memo: memo || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '상태 변경에 실패했습니다.')

      toast.success('리드 상태가 변경되었습니다.')
      onOpenChange(false)
      onSuccess()
    } catch (e: any) {
      toast.error(e.message || '상태 변경에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">리드 상태 변경</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {leadName}의 상태를 변경합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">상태</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="상태 선택" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {status === 'converted' && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                전환 금액 <span className="text-rose-500">*</span>
              </Label>
              <Input
                type="number"
                placeholder="전환 금액 (원)"
                value={conversionValue}
                onChange={e => setConversionValue(e.target.value)}
                min={0}
              />
            </div>
          )}

          {status === 'lost' && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">미전환 사유</Label>
              <Select value={lostReason} onValueChange={setLostReason}>
                <SelectTrigger>
                  <SelectValue placeholder="사유 선택" />
                </SelectTrigger>
                <SelectContent>
                  {LOST_REASONS.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">메모</Label>
            <Textarea
              placeholder="메모 입력 (선택)"
              value={memo}
              onChange={e => setMemo(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !status}>
            {submitting ? '변경 중...' : '변경'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
