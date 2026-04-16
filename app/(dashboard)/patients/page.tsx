'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Search, Plus, ChevronDown, ChevronUp, Check, AlertCircle, Calendar, List, ChevronLeft, ChevronRight, Clock, Phone, Edit2, Trash2, X, Settings } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useClinic } from '@/components/ClinicContext'
import { toast } from 'sonner'
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { PageHeader, ChannelBadge, SortSelect } from '@/components/common'
import { DateRangePicker } from '@/components/dashboard/date-range-picker'
import { DraggableBooking } from '@/components/patients/draggable-booking'
import { DroppableCell } from '@/components/patients/droppable-cell'
import { formatDate, formatDateTime, formatTime, toUtcDate } from '@/lib/date'
import { DateRange } from 'react-day-picker'
import { startOfDay, startOfMonth, endOfDay } from 'date-fns'

// 상수
const STATUS_CONFIG: Record<string, { label: string; variant: 'info' | 'success' | 'default' | 'secondary' | 'destructive' }> = {
  confirmed:             { label: '예약확정', variant: 'info' },
  visited:               { label: '방문완료', variant: 'success' },
  treatment_confirmed:   { label: '시술확정', variant: 'default' },  // 기존 데이터 표시용 (선택 불가)
  cancelled:             { label: '취소',     variant: 'secondary' },
  noshow:                { label: '노쇼',     variant: 'destructive' },
}
// 사용자가 선택 가능한 예약 상태 (시술확정 제외)
const SELECTABLE_STATUSES = ['confirmed', 'visited', 'cancelled', 'noshow'] as const

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']
// 요일 색상: 일=빨강, 토=파랑, 평일=기본
function getDayColor(dayIndex: number) {
  if (dayIndex === 0) return 'text-red-500'
  if (dayIndex === 6) return 'text-blue-500'
  return 'text-muted-foreground'
}

// 10분 단위 시간 옵션 생성 (00:00 ~ 23:50)
const TIME_OPTIONS = Array.from({ length: 24 * 6 }, (_, i) => {
  const h = Math.floor(i / 6)
  const m = (i % 6) * 10
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

// booking_datetime → { date, time } 파싱 (KST 기준, 10분 단위 반올림)
function parseBookingDateTime(dt: string | null | undefined): { date: string; time: string } {
  if (!dt) return { date: '', time: '' }
  const d = toUtcDate(dt)
  const date = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }) // YYYY-MM-DD
  const hh = Number(d.toLocaleString('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', hour12: false }).replace(/\D/g, '')) % 24
  const mm = d.toLocaleString('en-GB', { timeZone: 'Asia/Seoul', minute: '2-digit' }).replace(/\D/g, '')
  const rounded = Math.round(Number(mm) / 10) * 10
  const adjH = (rounded >= 60 ? hh + 1 : hh) % 24
  const adjM = rounded >= 60 ? 0 : rounded
  const time = `${String(adjH).padStart(2, '0')}:${String(adjM).padStart(2, '0')}`
  return { date, time }
}

// 예약 정보 수정 폼
function BookingEditForm({ booking, onSave }: { booking: any; onSave: () => void }) {
  const { date: initDate, time: initTime } = parseBookingDateTime(booking.booking_datetime)

  const [form, setForm] = useState({
    status: booking.status || 'confirmed',
    booking_date: initDate,
    booking_time: initTime,
    notes: booking.notes || '',
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!form.booking_date || !form.booking_time) {
      toast.error('예약 일시를 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      const booking_datetime = new Date(`${form.booking_date}T${form.booking_time}:00+09:00`).toISOString()
      const res = await fetch('/api/bookings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: booking.id, status: form.status, booking_datetime, notes: form.notes }),
      })
      if (!res.ok) throw new Error()
      toast.success('예약 정보가 저장되었습니다.')
      onSave()
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 mt-3">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">예약 상태</Label>
          <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SELECTABLE_STATUSES.map(k => (
                <SelectItem key={k} value={k}>{STATUS_CONFIG[k].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">예약 날짜</Label>
          <Input
            type="date"
            value={form.booking_date}
            onChange={e => setForm(f => ({ ...f, booking_date: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">예약 시간</Label>
          <Select value={form.booking_time} onValueChange={v => setForm(f => ({ ...f, booking_time: v }))}>
            <SelectTrigger>
              <SelectValue placeholder="시간 선택" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {TIME_OPTIONS.map(val => (
                <SelectItem key={val} value={val}>{val}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">메모</Label>
          <Input
            type="text"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="예약 관련 메모"
          />
        </div>
      </div>
      <div className="flex gap-4">
        {booking.created_at && (
          <p className="text-[11px] text-muted-foreground">
            등록: {formatDateTime(booking.created_at)}
          </p>
        )}
        {booking.updated_at && booking.updated_at !== booking.created_at && (
          <p className="text-[11px] text-muted-foreground">
            수정: {formatDateTime(booking.updated_at)}
          </p>
        )}
      </div>
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="bg-brand-600 hover:bg-brand-700">
          {saving ? '저장 중...' : '예약 저장'}
        </Button>
      </div>
    </div>
  )
}

// 상담 기록 섹션 (A: 이력 목록 + 새 상담 추가, E: Textarea 메모)
function ConsultationSection({ customerId, consultations, onSave }: { customerId: number; consultations: any[]; onSave: () => void }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    status: '',
    notes: '',
    consultationDate: '',
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/patients/${customerId}/consultation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      toast.success('상담 내용이 저장되었습니다.')
      setForm({ status: '', notes: '', consultationDate: '' })
      setShowForm(false)
      onSave()
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {/* 상담 이력 목록 */}
      {consultations.length > 0 ? (
        <div className="space-y-2 mb-3">
          {consultations.map((c: any, i: number) => (
            <div key={c.id || i} className="flex items-start gap-3 px-3 py-2 rounded-lg bg-muted/40 dark:bg-white/[0.03] border border-border dark:border-white/5">
              <div className="w-2 h-2 rounded-full bg-brand-500 mt-1.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {c.status && <Badge variant="secondary" className="text-[10px]">{c.status}</Badge>}
                  {c.consultation_date && <span className="text-[10px] text-muted-foreground">{formatDate(c.consultation_date)}</span>}
                </div>
                {c.notes && <p className="text-xs text-foreground/80 whitespace-pre-wrap">{c.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground mb-3">상담 기록이 없습니다.</p>
      )}

      {/* 새 상담 추가 */}
      {showForm ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg border border-border dark:border-white/5 bg-muted/20 dark:bg-white/[0.02]">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">상담 상태</Label>
            <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="선택" />
              </SelectTrigger>
              <SelectContent>
                {['상담대기', '상담중', '방문완료', '노쇼', '취소'].map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">상담 일시</Label>
            <Input
              type="date"
              value={form.consultationDate}
              onChange={e => setForm(f => ({ ...f, consultationDate: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label className="text-xs text-muted-foreground">메모</Label>
            <Textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="상담 내용을 자세히 기록하세요"
              rows={3}
              className="bg-muted dark:bg-white/5 border-border dark:border-white/10 text-foreground placeholder:text-muted-foreground/60"
            />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>취소</Button>
            <Button onClick={handleSave} disabled={saving} size="sm" className="bg-brand-600 hover:bg-brand-700">
              {saving ? '저장 중...' : '상담 저장'}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => setShowForm(true)} className="text-brand-400 hover:text-brand-300">
          <Plus size={13} /> 상담 기록 추가
        </Button>
      )}
    </div>
  )
}

// 시술 메뉴 관리 Dialog
function TreatmentManageDialog({ clinicId, open, onOpenChange }: { clinicId: number; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [items, setItems] = useState<{ id: number; name: string; category: string | null; default_price: number; is_active: boolean; sort_order: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', category: '', default_price: '' })
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ name: '', category: '', default_price: '' })

  const fetchItems = useCallback(() => {
    setLoading(true)
    fetch(`/api/clinic-treatments?clinic_id=${clinicId}&active_only=false`)
      .then(r => r.json())
      .then(d => setItems(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [clinicId])

  useEffect(() => { if (open) fetchItems() }, [open, fetchItems])

  const handleAdd = async () => {
    if (!form.name.trim()) { toast.error('시술명을 입력하세요.'); return }
    const price = Number(form.default_price)
    if (!form.default_price || isNaN(price) || price < 0) { toast.error('올바른 금액을 입력하세요.'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/clinic-treatments?clinic_id=${clinicId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, category: form.category || null, default_price: price }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '추가 실패')
      }
      setForm({ name: '', category: '', default_price: '' })
      toast.success('시술이 추가되었습니다.')
      fetchItems()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (id: number) => {
    if (!editForm.name.trim()) { toast.error('시술명을 입력하세요.'); return }
    const price = Number(editForm.default_price)
    if (isNaN(price) || price < 0) { toast.error('올바른 금액을 입력하세요.'); return }
    try {
      const res = await fetch(`/api/clinic-treatments?clinic_id=${clinicId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: editForm.name, category: editForm.category || null, default_price: price }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '수정 실패')
      }
      setEditingId(null)
      toast.success('수정되었습니다.')
      fetchItems()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const handleToggleActive = async (item: typeof items[0]) => {
    try {
      const res = await fetch(`/api/clinic-treatments?clinic_id=${clinicId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, is_active: !item.is_active }),
      })
      if (!res.ok) throw new Error()
      fetchItems()
    } catch {
      toast.error('변경 실패')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('이 시술 항목을 삭제하시겠습니까?')) return
    try {
      const res = await fetch(`/api/clinic-treatments?clinic_id=${clinicId}&id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('삭제되었습니다.')
      fetchItems()
    } catch {
      toast.error('삭제 실패')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>시술 메뉴 관리</DialogTitle>
        </DialogHeader>

        {/* 시술 목록 */}
        <div className="max-h-[320px] overflow-y-auto space-y-1.5 py-2">
          {loading ? (
            <div className="space-y-2">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">등록된 시술이 없습니다.</p>
          ) : (
            items.map(item => (
              <div key={item.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${item.is_active ? 'border-border dark:border-white/5 bg-muted/30 dark:bg-white/[0.02]' : 'border-border/50 bg-muted/10 opacity-50'}`}>
                {editingId === item.id ? (
                  <>
                    <Input
                      value={editForm.name}
                      onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                      className="h-7 text-xs flex-1"
                      placeholder="시술명"
                    />
                    <Input
                      value={editForm.category}
                      onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                      className="h-7 text-xs w-20"
                      placeholder="카테고리"
                    />
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={formatAmount(editForm.default_price)}
                      onChange={e => setEditForm(f => ({ ...f, default_price: parseAmount(e.target.value) }))}
                      className="h-7 text-xs w-24"
                      placeholder="금액"
                    />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-brand-400" onClick={() => handleUpdate(item.id)}>
                      <Check size={13} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}>
                      <X size={13} />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="text-sm text-foreground flex-1 truncate">{item.name}</span>
                    {item.category && <span className="text-[10px] text-muted-foreground bg-muted dark:bg-white/5 px-1.5 py-0.5 rounded-full shrink-0">{item.category}</span>}
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 shrink-0 w-20 text-right">₩{item.default_price.toLocaleString()}</span>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                      onClick={() => { setEditingId(item.id); setEditForm({ name: item.name, category: item.category || '', default_price: String(item.default_price) }) }}
                    >
                      <Edit2 size={11} />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                      onClick={() => handleToggleActive(item)}
                      title={item.is_active ? '비활성화' : '활성화'}
                    >
                      {item.is_active ? <Check size={11} className="text-emerald-500" /> : <AlertCircle size={11} className="text-muted-foreground" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-red-400 hover:text-red-300" onClick={() => handleDelete(item.id)}>
                      <Trash2 size={11} />
                    </Button>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* 추가 폼 */}
        <div className="border-t border-border dark:border-white/5 pt-3">
          <p className="text-xs text-muted-foreground font-medium mb-2">새 시술 추가</p>
          <div className="flex gap-2">
            <Input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="시술명"
              className="flex-1 h-9 text-sm"
            />
            <Input
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              placeholder="카테고리"
              className="w-24 h-9 text-sm"
            />
            <Input
              type="text"
              inputMode="numeric"
              value={formatAmount(form.default_price)}
              onChange={e => setForm(f => ({ ...f, default_price: parseAmount(e.target.value) }))}
              placeholder="기본 금액"
              className="w-28 h-9 text-sm"
              min="0"
            />
            <Button onClick={handleAdd} disabled={saving} size="sm" className="bg-brand-600 hover:bg-brand-700 h-9 shrink-0">
              <Plus size={14} /> {saving ? '...' : '추가'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// H: POS형 결제 섹션 (시술 카탈로그 선택 + 금액 자동 채움 + 수정 가능)
// D: 합계 표시, C: 폼 접기
type CartItem = { key: string; treatmentName: string; paymentAmount: string }

// 숫자 → 콤마 포맷 (예: 1500000 → "1,500,000")
function formatAmount(val: string | number): string {
  const num = String(val).replace(/[^\d]/g, '')
  if (!num) return ''
  return Number(num).toLocaleString()
}
// 콤마 포맷 → 순수 숫자 문자열
function parseAmount(val: string): string {
  return val.replace(/[^\d]/g, '')
}

function PaymentSection({ customerId, payments, onSave, isSuperAdmin, clinicId, treatmentRefreshKey }: {
  customerId: number; payments: any[]; onSave: () => void; isSuperAdmin?: boolean; clinicId?: number | null; treatmentRefreshKey?: number
}) {
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [treatments, setTreatments] = useState<{ id: number; name: string; category: string | null; default_price: number }[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [customInput, setCustomInput] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customAmount, setCustomAmount] = useState('')

  // 시술 카탈로그 로드 (treatmentRefreshKey 변경 시 재로드)
  useEffect(() => {
    if (!clinicId) return
    fetch(`/api/clinic-treatments?clinic_id=${clinicId}`)
      .then(r => r.json())
      .then(d => setTreatments(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [clinicId, treatmentRefreshKey])

  const totalPayment = payments.reduce((s: number, p: any) => s + Number(p.payment_amount), 0)
  const cartTotal = cart.reduce((s, item) => s + (Number(item.paymentAmount) || 0), 0)

  const handleTreatmentSelect = (treatmentName: string) => {
    if (treatmentName === '__custom__') {
      setCustomInput(true)
      return
    }
    const found = treatments.find(t => t.name === treatmentName)
    setCart(prev => [...prev, {
      key: `${treatmentName}-${Date.now()}`,
      treatmentName,
      paymentAmount: found ? String(found.default_price) : '',
    }])
  }

  const addCustomItem = () => {
    if (!customName.trim()) { toast.error('시술명을 입력하세요.'); return }
    const amount = Number(customAmount)
    if (!customAmount || isNaN(amount) || amount <= 0) { toast.error('올바른 금액을 입력하세요.'); return }
    setCart(prev => [...prev, { key: `custom-${Date.now()}`, treatmentName: customName, paymentAmount: customAmount }])
    setCustomName('')
    setCustomAmount('')
    setCustomInput(false)
  }

  const removeCartItem = (key: string) => setCart(prev => prev.filter(i => i.key !== key))

  const updateCartAmount = (key: string, amount: string) => {
    setCart(prev => prev.map(i => i.key === key ? { ...i, paymentAmount: amount } : i))
  }

  const handleSave = async () => {
    if (cart.length === 0) { toast.error('시술 항목을 선택해주세요.'); return }
    const invalid = cart.find(i => !i.treatmentName.trim() || !i.paymentAmount || Number(i.paymentAmount) <= 0)
    if (invalid) { toast.error('모든 항목의 시술명과 금액을 확인해주세요.'); return }

    setSaving(true)
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
    try {
      for (const item of cart) {
        const res = await fetch(`/api/patients/${customerId}/payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ treatmentName: item.treatmentName, paymentAmount: Number(item.paymentAmount), paymentDate: today }),
        })
        if (!res.ok) throw new Error()
      }
      setCart([])
      setShowForm(false)
      setCustomInput(false)
      toast.success(`${cart.length}건의 결제가 등록되었습니다.`)
      onSave()
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // 카테고리별 그룹핑
  const grouped = treatments.reduce((acc, t) => {
    const cat = t.category || '기타'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(t)
    return acc
  }, {} as Record<string, typeof treatments>)

  return (
    <div>
      {/* D: 결제 요약 */}
      {payments.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 mb-3">
          <span className="text-xs text-muted-foreground">총 {payments.length}건 결제</span>
          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">₩{totalPayment.toLocaleString()}</span>
        </div>
      )}

      {/* 결제 내역 목록 */}
      {payments.length > 0 && (
        <Table className="mb-3">
          <TableHeader>
            <TableRow className="border-b border-border dark:border-white/5 hover:bg-transparent">
              <TableHead className="text-xs text-muted-foreground uppercase tracking-wider font-medium">시술명</TableHead>
              <TableHead className="text-xs text-muted-foreground uppercase tracking-wider font-medium text-right">금액</TableHead>
              <TableHead className="text-xs text-muted-foreground uppercase tracking-wider font-medium">결제일</TableHead>
              {isSuperAdmin && <TableHead className="text-xs text-muted-foreground uppercase tracking-wider font-medium w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p: any) => (
              <TableRow key={p.id} className="border-b border-border dark:border-white/5">
                <TableCell className="text-foreground text-sm">{p.treatment_name}</TableCell>
                <TableCell className="text-emerald-600 dark:text-emerald-400 font-semibold text-right">₩{Number(p.payment_amount).toLocaleString()}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{formatDate(p.payment_date)}</TableCell>
                {isSuperAdmin && (
                  <TableCell>
                    <button
                      onClick={async () => {
                        if (!confirm('이 결제 내역을 삭제하시겠습니까?')) return
                        try {
                          const res = await fetch(`/api/payments/${p.id}`, { method: 'DELETE' })
                          if (!res.ok) throw new Error()
                          toast.success('결제 내역이 삭제되었습니다.')
                          onSave()
                        } catch { toast.error('삭제에 실패했습니다.') }
                      }}
                      className="text-red-400 hover:text-red-300 p-1"
                    >
                      <Trash2 size={13} />
                    </button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* C: 결제 추가 폼 (접기/펼치기) */}
      {showForm ? (
        <div className="p-3 rounded-lg border border-border dark:border-white/5 bg-muted/20 dark:bg-white/[0.02] space-y-3">
          {/* 시술 선택 드롭다운 */}
          <div className="flex gap-2 items-end">
            {treatments.length > 0 && !customInput ? (
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground mb-1.5 block">시술 항목 선택</Label>
                <Select value="" onValueChange={handleTreatmentSelect}>
                  <SelectTrigger className="bg-muted dark:bg-white/5 text-foreground border-border dark:border-white/10">
                    <SelectValue placeholder="시술을 선택하면 아래에 추가됩니다" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(grouped).map(([cat, items]) => (
                      <div key={cat}>
                        {Object.keys(grouped).length > 1 && (
                          <div className="px-2 py-1.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{cat}</div>
                        )}
                        {items.map(t => (
                          <SelectItem key={t.id} value={t.name}>
                            <span className="flex items-center gap-2">
                              {t.name}
                              <span className="text-muted-foreground text-[10px]">₩{t.default_price.toLocaleString()}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                    <SelectItem value="__custom__">
                      <span className="text-brand-400">직접 입력</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground mb-1.5 block">직접 입력</Label>
                <div className="flex gap-2">
                  <Input
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    placeholder="시술명"
                    className="flex-1 bg-muted dark:bg-white/5 text-foreground border-border dark:border-white/10"
                  />
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formatAmount(customAmount)}
                    onChange={e => setCustomAmount(parseAmount(e.target.value))}
                    placeholder="금액"
                    className="w-28 bg-muted dark:bg-white/5 text-foreground border-border dark:border-white/10"
                  />
                  <Button variant="outline" size="sm" className="h-10 shrink-0" onClick={addCustomItem}>
                    <Plus size={14} />
                  </Button>
                  {treatments.length > 0 && (
                    <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={() => setCustomInput(false)} title="목록에서 선택">
                      <List size={14} />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 장바구니 목록 */}
          {cart.length > 0 && (
            <div className="space-y-1.5">
              {cart.map(item => (
                <div key={item.key} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 dark:bg-white/[0.03] border border-border dark:border-white/5">
                  <span className="text-sm text-foreground flex-1 truncate">{item.treatmentName}</span>
                  <span className="text-muted-foreground text-xs">₩</span>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formatAmount(item.paymentAmount)}
                    onChange={e => updateCartAmount(item.key, parseAmount(e.target.value))}
                    className="w-28 h-7 text-xs text-right bg-transparent border-border dark:border-white/10"
                  />
                  <button onClick={() => removeCartItem(item.key)} className="text-red-400 hover:text-red-300 p-1 shrink-0">
                    <X size={13} />
                  </button>
                </div>
              ))}
              <div className="flex items-center justify-between px-3 py-1.5">
                <span className="text-xs text-muted-foreground">{cart.length}건 합계</span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">₩{cartTotal.toLocaleString()}</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setCart([]); setCustomInput(false); setCustomName(''); setCustomAmount('') }}>취소</Button>
            <Button onClick={handleSave} disabled={saving || cart.length === 0} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
              <Plus size={14} /> {saving ? '저장 중...' : `결제 등록 (${cart.length}건)`}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => setShowForm(true)} className="text-emerald-500 hover:text-emerald-400">
          <Plus size={13} /> 결제 내역 추가
        </Button>
      )}
    </div>
  )
}

// F: 탭→섹션 전환 (예약/상담/결제를 한 화면에 세로 배치)
// G: 목록에 상담 횟수 + 상태 표시
function BookingRow({ booking, onRefresh, isSuperAdmin, clinicId, isOpen, onToggle }: { booking: any; onRefresh: () => void; isSuperAdmin?: boolean; clinicId?: number | null; isOpen: boolean; onToggle: () => void }) {
  const [expandedSection, setExpandedSection] = useState<'booking' | 'consult' | 'payment' | null>(null)
  const [changingStatus, setChangingStatus] = useState(false)
  const [treatmentDialogOpen, setTreatmentDialogOpen] = useState(false)
  const [treatmentRefreshKey, setTreatmentRefreshKey] = useState(0)
  const { data: session } = useSession()
  const canManageTreatments = session?.user?.role === 'superadmin' || session?.user?.role === 'clinic_admin'

  const customer = booking.customer
  const cfg = STATUS_CONFIG[booking.status] || { label: booking.status, variant: 'secondary' as const }
  const totalPayment = (customer?.payments || []).reduce((s: number, p: any) => s + Number(p.payment_amount), 0)
  const consultations: any[] = customer?.consultations || []
  // 유입 경로: utm_source가 있는 첫 번째 리드 기준, 없으면 first_source 폴백
  const leads: any[] = customer?.leads || []
  const leadWithSource = leads.find((l: any) => l.utm_source) || leads[0]
  const channelSource = leadWithSource?.utm_source || customer?.first_source || null
  const campaignName = leadWithSource?.utm_campaign || null
  const latestConsult = consultations[0]
  const consultCount = consultations.length

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === booking.status) return
    setChangingStatus(true)
    try {
      const res = await fetch('/api/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: booking.id, status: newStatus }),
      })
      if (!res.ok) throw new Error()
      const statusLabel = STATUS_CONFIG[newStatus]?.label || newStatus
      toast.success(`예약 상태가 "${statusLabel}"(으)로 변경되었습니다.`)
      onRefresh()
    } catch {
      toast.error('상태 변경에 실패했습니다.')
    } finally {
      setChangingStatus(false)
    }
  }

  return (
    <Card variant="glass" className="overflow-hidden">
      <button
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted dark:hover:bg-white/[0.03] transition-colors text-left"
        onClick={() => {
          if (!isOpen) setExpandedSection('booking')
          onToggle()
        }}
        aria-expanded={isOpen}
        aria-label={`${customer?.name || '고객'} 상세정보 ${isOpen ? '접기' : '펼치기'}`}
      >
        <div className="w-9 h-9 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 font-bold text-sm shrink-0">
          {customer?.name?.[0] || '?'}
        </div>
        <div className="w-40 shrink-0 min-w-0">
          <p className="font-medium text-foreground text-sm truncate">{customer?.name || '이름 없음'}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate"><Phone size={10} /> {customer?.phone_number}</p>
        </div>
        <div className="w-40 shrink-0">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock size={11} />
            {booking.booking_datetime ? formatDateTime(booking.booking_datetime) : '-'}
          </div>
          {booking.created_at && (
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">등록: {formatDateTime(booking.created_at)}</p>
          )}
        </div>
        <div className="w-32 shrink-0 min-w-0">
          {channelSource ? (
            <div className="space-y-0.5">
              <ChannelBadge channel={channelSource} className="text-[10px] px-1.5 py-0" />
              {campaignName && <p className="text-[10px] text-muted-foreground/70 truncate">{campaignName}</p>}
            </div>
          ) : (
            <span className="text-muted-foreground/60 text-xs">-</span>
          )}
        </div>
        <div className="flex-1" />
        <div className="w-28 shrink-0" onClick={e => e.stopPropagation()}>
          <Select value={booking.status} onValueChange={handleStatusChange} disabled={changingStatus}>
            <SelectTrigger className="h-7 px-2 text-xs border-0 bg-transparent hover:bg-muted dark:hover:bg-white/5 focus:ring-0 w-full">
              <Badge variant={cfg.variant} className="whitespace-nowrap">{changingStatus ? '변경 중...' : cfg.label}</Badge>
            </SelectTrigger>
            <SelectContent>
              {SELECTABLE_STATUSES.map(k => (
                <SelectItem key={k} value={k}>
                  <Badge variant={STATUS_CONFIG[k].variant} className="text-[10px] px-1.5 py-0">{STATUS_CONFIG[k].label}</Badge>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* G: 상담 횟수 + 상태 표시 */}
        <div className="w-24 shrink-0">
          {latestConsult
            ? <div className="flex items-center gap-1">
                <Badge variant="secondary" className="text-[10px]">{latestConsult.status}</Badge>
                {consultCount > 1 && <span className="text-[10px] text-muted-foreground">({consultCount})</span>}
              </div>
            : <span className="text-muted-foreground/60 text-xs">-</span>}
        </div>
        <div className="w-28 shrink-0 text-right">
          {totalPayment > 0
            ? <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">₩{totalPayment.toLocaleString()}</span>
            : <span className="text-muted-foreground/60 text-sm">-</span>}
        </div>
        {isOpen ? <ChevronUp size={16} className="text-muted-foreground shrink-0" /> : <ChevronDown size={16} className="text-muted-foreground shrink-0" />}
      </button>

      {/* 아코디언 섹션 레이아웃 */}
      {isOpen && (
        <div className="border-t border-border dark:border-white/5 px-5 py-3 space-y-1">
          {/* 섹션 1: 예약 정보 (아코디언) */}
          <div className="rounded-lg border border-border dark:border-white/5 overflow-hidden">
            <button
              onClick={() => setExpandedSection(s => s === 'booking' ? null : 'booking')}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 dark:hover:bg-white/[0.02] transition-colors"
            >
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Edit2 size={11} /> 예약 정보
              </span>
              <ChevronDown size={13} className={`text-muted-foreground transition-transform ${expandedSection === 'booking' ? 'rotate-180' : ''}`} />
            </button>
            {expandedSection === 'booking' && (
              <div className="px-3 pb-3">
                <BookingEditForm booking={booking} onSave={onRefresh} />
              </div>
            )}
          </div>

          {/* 섹션 2: 상담 기록 (아코디언) */}
          <div className="rounded-lg border border-border dark:border-white/5 overflow-hidden">
            <button
              onClick={() => setExpandedSection(s => s === 'consult' ? null : 'consult')}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 dark:hover:bg-white/[0.02] transition-colors"
            >
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <List size={11} /> 상담 기록 {consultCount > 0 && <span className="text-brand-400">({consultCount})</span>}
              </span>
              <ChevronDown size={13} className={`text-muted-foreground transition-transform ${expandedSection === 'consult' ? 'rotate-180' : ''}`} />
            </button>
            {expandedSection === 'consult' && (
              <div className="px-3 pb-3">
                <ConsultationSection customerId={customer?.id} consultations={consultations} onSave={onRefresh} />
              </div>
            )}
          </div>

          {/* 섹션 3: 결제 내역 (아코디언) */}
          <div className="rounded-lg border border-border dark:border-white/5 overflow-hidden">
            <button
              onClick={() => setExpandedSection(s => s === 'payment' ? null : 'payment')}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 dark:hover:bg-white/[0.02] transition-colors"
            >
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Plus size={11} /> 결제 내역 {(customer?.payments || []).length > 0 && <span className="text-emerald-500">({(customer?.payments || []).length})</span>}
              </span>
              <div className="flex items-center gap-1">
                {canManageTreatments && clinicId && (
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); setTreatmentDialogOpen(true) }}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-muted"
                    title="시술 메뉴 관리"
                  >
                    <Settings size={12} />
                  </span>
                )}
                <ChevronDown size={13} className={`text-muted-foreground transition-transform ${expandedSection === 'payment' ? 'rotate-180' : ''}`} />
              </div>
            </button>
            {expandedSection === 'payment' && (
              <div className="px-3 pb-3">
                <PaymentSection customerId={customer?.id} payments={customer?.payments || []} onSave={onRefresh} isSuperAdmin={isSuperAdmin} clinicId={clinicId} treatmentRefreshKey={treatmentRefreshKey} />
              </div>
            )}
            {canManageTreatments && clinicId && (
              <TreatmentManageDialog clinicId={clinicId} open={treatmentDialogOpen} onOpenChange={(v) => { setTreatmentDialogOpen(v); if (!v) setTreatmentRefreshKey(k => k + 1) }} />
            )}
          </div>

          {isSuperAdmin && (
            <div className="pt-2 flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  if (!confirm('이 예약을 삭제하시겠습니까?')) return
                  try {
                    const res = await fetch(`/api/bookings?id=${booking.id}`, { method: 'DELETE' })
                    if (!res.ok) throw new Error()
                    toast.success('예약이 삭제되었습니다.')
                    onRefresh()
                  } catch { toast.error('삭제에 실패했습니다.') }
                }}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <Trash2 size={14} /> 예약 삭제
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  if (!confirm(`${customer?.name || '이 고객'}의 모든 데이터(리드, 예약, 상담, 결제)가 삭제됩니다. 계속하시겠습니까?`)) return
                  try {
                    const res = await fetch(`/api/patients/${customer?.id}`, { method: 'DELETE' })
                    if (!res.ok) throw new Error()
                    toast.success('고객 데이터가 삭제되었습니다.')
                    onRefresh()
                  } catch { toast.error('삭제에 실패했습니다.') }
                }}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <Trash2 size={14} /> 고객 전체 삭제
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// 일간 뷰 컴포넌트 (10분 단위 슬롯)
const DAY_START_HOUR = 10
const DAY_END_HOUR = 20
const SLOTS_PER_HOUR = 6
const TOTAL_DAY_SLOTS = (DAY_END_HOUR - DAY_START_HOUR) * SLOTS_PER_HOUR

function DayView({ currentMonth, bookingsByDate, todayKey, selectedDate, onSelectDate }: {
  currentMonth: Date
  bookingsByDate: Record<string, any[]>
  todayKey: string
  selectedDate: string | null
  onSelectDate: (date: string | null) => void
}) {
  const nowLineRef = useRef<HTMLDivElement>(null)
  const dateKey = currentMonth.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
  const isToday = dateKey === todayKey
  const dayBookings = bookingsByDate[dateKey] || []

  // 현재 시간 슬롯 인덱스 (오늘인 경우만)
  const nowSlotIndex = useMemo(() => {
    if (!isToday) return -1
    const now = new Date()
    const h = Number(now.toLocaleString('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', hour12: false }).replace(/\D/g, '')) % 24
    const m = Number(now.toLocaleString('en-GB', { timeZone: 'Asia/Seoul', minute: '2-digit' }).replace(/\D/g, ''))
    const idx = (h - DAY_START_HOUR) * SLOTS_PER_HOUR + Math.floor(m / 10)
    return (idx >= 0 && idx < TOTAL_DAY_SLOTS) ? idx : -1
  }, [isToday])

  // 자동 스크롤: 오늘 진입 시 현재 시간 위치로
  useEffect(() => {
    if (nowSlotIndex >= 0 && nowLineRef.current) {
      nowLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [nowSlotIndex])

  // 10분 단위 슬롯 그룹핑
  const bySlot: Record<number, any[]> = {}
  for (const b of dayBookings) {
    const dt = toUtcDate(b.booking_datetime)
    const h = Number(dt.toLocaleString('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', hour12: false }).replace(/\D/g, '')) % 24
    const m = Number(dt.toLocaleString('en-GB', { timeZone: 'Asia/Seoul', minute: '2-digit' }).replace(/\D/g, ''))
    const slotIndex = (h - DAY_START_HOUR) * SLOTS_PER_HOUR + Math.floor(m / 10)
    if (slotIndex < 0 || slotIndex >= TOTAL_DAY_SLOTS) continue
    if (!bySlot[slotIndex]) bySlot[slotIndex] = []
    bySlot[slotIndex].push(b)
  }

  return (
    <div className="space-y-0">
      {Array.from({ length: TOTAL_DAY_SLOTS }, (_, i) => {
        const hour = DAY_START_HOUR + Math.floor(i / SLOTS_PER_HOUR)
        const minute = (i % SLOTS_PER_HOUR) * 10
        const isHourMark = minute === 0
        const isHalfHour = minute === 30
        const slotBookings = bySlot[i] || []

        const isNowSlot = i === nowSlotIndex

        return (
          <div
            key={i}
            ref={isNowSlot ? nowLineRef : undefined}
            className={`flex relative ${
              isHourMark ? 'border-t border-border dark:border-white/10 min-h-[36px]' :
              isHalfHour ? 'border-t border-border/40 dark:border-white/5 min-h-[24px]' :
              'border-t border-border/15 dark:border-white/[0.02] min-h-[24px]'
            }`}
          >
            {isNowSlot && (
              <div className="absolute top-0 left-12 right-0 flex items-center z-10 pointer-events-none">
                <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shrink-0" />
                <div className="flex-1 h-[2px] bg-red-500" />
              </div>
            )}
            <div className={`w-14 shrink-0 py-0.5 text-right pr-2 ${isHourMark ? 'text-[11px] text-muted-foreground' : 'text-[10px] text-muted-foreground/40'}`}>
              {isHourMark
                ? `${String(hour).padStart(2, '0')}:00`
                : isHalfHour
                  ? `:30`
                  : `:${String(minute).padStart(2, '0')}`}
            </div>
            <DroppableCell
              id={`day-${dateKey}-${hour}-${minute}`}
              dateKey={dateKey}
              hour={hour}
              minute={minute}
              className="flex-1 py-0.5 space-y-0.5"
            >
              {slotBookings.map((b: any) => {
                const c = STATUS_CONFIG[b.status] || { label: b.status, variant: 'secondary' as const }
                return (
                  <DraggableBooking key={b.id} booking={b} variant="day" statusConfig={c} />
                )
              })}
            </DroppableCell>
          </div>
        )
      })}
    </div>
  )
}

// 메인 페이지
export default function PatientsPage() {
  const { selectedClinicId } = useClinic()
  const { data: session } = useSession()
  const isSuperAdmin = session?.user?.role === 'superadmin'
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [calView, setCalView] = useState<'month' | 'week' | 'day'>('month')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'unpaid'>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name' | 'payment'>('newest')
  const [dateRange, setDateRange] = useState<DateRange>({ from: startOfMonth(startOfDay(new Date())), to: startOfDay(new Date()) })
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  // 예약 등록 다이얼로그
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '', phone_number: '',
    booking_date: '', booking_time: '',
    source: 'walk-in', notes: '',
  })
  const [creating, setCreating] = useState(false)
  const [openBookingId, setOpenBookingId] = useState<number | null>(null)

  // 드래그앤드롭 상태
  const [draggedBooking, setDraggedBooking] = useState<any>(null)
  const [dndConfirm, setDndConfirm] = useState<{ booking: any; targetDateKey: string; targetHour?: number; targetMinute?: number; selectedTime: string } | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  const handleDragStart = (event: DragStartEvent) => {
    setDraggedBooking(event.active.data.current?.booking || null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggedBooking(null)
    const { active, over } = event
    if (!over) return

    const booking = active.data.current?.booking
    const targetDateKey = over.data.current?.dateKey as string
    const targetHour = over.data.current?.hour as number | undefined
    const targetMinute = over.data.current?.minute as number | undefined
    if (!booking || !targetDateKey) return

    const dt = toUtcDate(booking.booking_datetime)
    const currentDateKey = dt.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
    const currentHour = Number(dt.toLocaleString('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', hour12: false }).replace(/\D/g, '')) % 24
    const currentMinute = Number(dt.toLocaleString('en-GB', { timeZone: 'Asia/Seoul', minute: '2-digit' }).replace(/\D/g, ''))

    // 같은 위치 드롭 감지
    const sameDate = targetDateKey === currentDateKey
    const sameTime = targetHour === undefined || (targetHour === currentHour && (targetMinute === undefined || targetMinute === Math.floor(currentMinute / 10) * 10))
    if (sameDate && sameTime) return

    // 기존 시간을 초기값으로 세팅 (일간 뷰에서 드롭한 슬롯이 있으면 해당 시간 사용)
    const currentTime = dt.toLocaleString('en-GB', {
      timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false,
    })
    const initialTime = (targetHour !== undefined && targetMinute !== undefined)
      ? `${String(targetHour).padStart(2, '0')}:${String(targetMinute).padStart(2, '0')}`
      : targetHour !== undefined
        ? `${String(targetHour).padStart(2, '0')}:00`
        : currentTime

    setDndConfirm({ booking, targetDateKey, targetHour, targetMinute, selectedTime: initialTime })
  }

  const executeDndMove = async () => {
    if (!dndConfirm) return
    const { booking, targetDateKey, selectedTime } = dndConfirm
    setDndConfirm(null)

    const newDatetime = new Date(`${targetDateKey}T${selectedTime}:00+09:00`).toISOString()

    try {
      const res = await fetch('/api/bookings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: booking.id, booking_datetime: newDatetime }),
      })
      if (!res.ok) throw new Error()
      toast.success('예약 일정이 변경되었습니다.')
      fetchBookings()
    } catch {
      toast.error('예약 일정 변경에 실패했습니다.')
    }
  }

  const initCreateForm = () => {
    const now = new Date()
    const kstH = Number(now.toLocaleString('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', hour12: false }).replace(/\D/g, '')) % 24
    const kstM = Number(now.toLocaleString('en-GB', { timeZone: 'Asia/Seoul', minute: '2-digit' }).replace(/\D/g, ''))
    const rounded = Math.ceil(kstM / 10) * 10
    const finalH = (rounded >= 60 ? kstH + 1 : kstH) % 24
    const finalM = rounded >= 60 ? 0 : rounded
    const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
    const timeStr = `${String(finalH).padStart(2, '0')}:${String(finalM).padStart(2, '0')}`
    setCreateForm({
      name: '', phone_number: '',
      booking_date: dateStr, booking_time: timeStr,
      source: 'walk-in', notes: '',
    })
  }

  const fetchBookings = useCallback(async () => {
    setLoading(true)
    try {
      const qs = selectedClinicId ? `?clinic_id=${selectedClinicId}` : ''
      const res = await fetch(`/api/bookings${qs}`)
      const data = await res.json()
      setBookings(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }, [selectedClinicId])

  useEffect(() => { fetchBookings() }, [fetchBookings])

  const handleCreate = async () => {
    if (!createForm.phone_number) {
      toast.error('전화번호를 입력해주세요.')
      return
    }
    if (!createForm.booking_date || !createForm.booking_time) {
      toast.error('예약 일시를 입력해주세요.')
      return
    }
    setCreating(true)
    try {
      const booking_datetime = new Date(`${createForm.booking_date}T${createForm.booking_time}:00+09:00`).toISOString()
      const qs = selectedClinicId ? `?clinic_id=${selectedClinicId}` : ''
      const res = await fetch(`/api/bookings${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name,
          phone_number: createForm.phone_number,
          booking_datetime,
          source: createForm.source,
          notes: createForm.notes,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      toast.success('예약이 등록되었습니다.')
      setCreateOpen(false)
      fetchBookings()
    } catch (e: any) {
      toast.error(e.message || '예약 등록 실패')
    } finally {
      setCreating(false)
    }
  }

  // 유입 경로 목록 (필터 드롭다운용)
  const sourceOptions = useMemo(() => {
    const sources = new Set<string>()
    for (const b of bookings) {
      const leads = b.customer?.leads || []
      const lead = leads.find((l: any) => l.utm_source) || leads[0]
      const src = lead?.utm_source || b.customer?.first_source
      if (src) sources.add(src)
    }
    return Array.from(sources).sort()
  }, [bookings])

  const filtered = useMemo(() => {
    const result = bookings.filter(b => {
      // 검색
      const matchSearch = !search || b.customer?.name?.includes(search) || b.customer?.phone_number?.includes(search)
      // 상태
      const matchStatus = statusFilter === 'all' || b.status === statusFilter
      // 날짜 범위
      let matchDate = true
      if (dateRange.from && b.booking_datetime) {
        const bDate = toUtcDate(b.booking_datetime)
        const from = startOfDay(dateRange.from)
        const to = endOfDay(dateRange.to || dateRange.from)
        matchDate = bDate >= from && bDate <= to
      }
      // 유입 경로
      let matchSource = true
      if (sourceFilter !== 'all') {
        const leads = b.customer?.leads || []
        const lead = leads.find((l: any) => l.utm_source) || leads[0]
        const src = lead?.utm_source || b.customer?.first_source || ''
        matchSource = src === sourceFilter
      }
      // 결제 여부
      let matchPayment = true
      if (paymentFilter !== 'all') {
        const totalPay = (b.customer?.payments || []).reduce((s: number, p: any) => s + Number(p.payment_amount), 0)
        matchPayment = paymentFilter === 'paid' ? totalPay > 0 : totalPay === 0
      }
      return matchSearch && matchStatus && matchDate && matchSource && matchPayment
    })
    // 정렬
    result.sort((a, b) => {
      if (sortBy === 'oldest') return new Date(a.booking_datetime || 0).getTime() - new Date(b.booking_datetime || 0).getTime()
      if (sortBy === 'name') return (a.customer?.name || '').localeCompare(b.customer?.name || '', 'ko')
      if (sortBy === 'payment') {
        const pa = (a.customer?.payments || []).reduce((s: number, p: any) => s + Number(p.payment_amount), 0)
        const pb = (b.customer?.payments || []).reduce((s: number, p: any) => s + Number(p.payment_amount), 0)
        return pb - pa
      }
      // newest (default)
      return new Date(b.booking_datetime || 0).getTime() - new Date(a.booking_datetime || 0).getTime()
    })
    return result
  }, [bookings, search, statusFilter, dateRange, sourceFilter, paymentFilter, sortBy])

  const activeFilterCount = [
    statusFilter !== 'all',
    sourceFilter !== 'all',
    paymentFilter !== 'all',
  ].filter(Boolean).length

  const stats = useMemo(() => ({
    total: filtered.length,
    visited: filtered.filter(b => b.status === 'visited').length,
    noshow: filtered.filter(b => b.status === 'noshow').length,
    revenue: filtered.reduce((s, b) => s + (b.customer?.payments || []).reduce((ps: number, p: any) => ps + Number(p.payment_amount), 0), 0),
  }), [filtered])

  // 캘린더 데이터 준비 (상태·유입경로·결제 필터 반영, 날짜 필터는 캘린더 자체 네비게이션 사용)
  const calendarBookings = useMemo(() => {
    return bookings.filter(b => {
      const matchStatus = statusFilter === 'all' || b.status === statusFilter
      let matchSource = true
      if (sourceFilter !== 'all') {
        const leads = b.customer?.leads || []
        const lead = leads.find((l: any) => l.utm_source) || leads[0]
        const src = lead?.utm_source || b.customer?.first_source || ''
        matchSource = src === sourceFilter
      }
      let matchPayment = true
      if (paymentFilter !== 'all') {
        const totalPay = (b.customer?.payments || []).reduce((s: number, p: any) => s + Number(p.payment_amount), 0)
        matchPayment = paymentFilter === 'paid' ? totalPay > 0 : totalPay === 0
      }
      return matchStatus && matchSource && matchPayment
    })
  }, [bookings, statusFilter, sourceFilter, paymentFilter])

  const bookedDates = useMemo(() => {
    const dateSet = new Set<string>()
    for (const b of bookings) {
      if (b.booking_datetime) {
        dateSet.add(toUtcDate(b.booking_datetime).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }))
      }
    }
    return Array.from(dateSet).map(d => new Date(d + 'T00:00:00+09:00'))
  }, [bookings])

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const bookingsByDate: Record<string, any[]> = {}
  for (const b of calendarBookings) {
    if (!b.booking_datetime) continue
    const key = toUtcDate(b.booking_datetime).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
    if (!bookingsByDate[key]) bookingsByDate[key] = []
    bookingsByDate[key].push(b)
  }
  // 날짜별 시간순 정렬
  for (const key of Object.keys(bookingsByDate)) {
    bookingsByDate[key].sort((a: any, b: any) =>
      new Date(a.booking_datetime).getTime() - new Date(b.booking_datetime).getTime()
    )
  }
  const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })

  // 주간 뷰 날짜 계산
  const getWeekDates = (baseDate: Date) => {
    const d = new Date(baseDate)
    const day = d.getDay()
    d.setDate(d.getDate() - day) // 일요일부터
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(d)
      date.setDate(d.getDate() + i)
      return date
    })
  }
  const weekDates = getWeekDates(currentMonth)

  return (
    <>
      <PageHeader
        title="예약 / 결제 관리"
        description="예약 현황, 상담 기록 및 결제 내역 통합 관리"
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => { initCreateForm(); setCreateOpen(true) }} className="bg-brand-600 hover:bg-brand-700">
              <Plus size={14} /> 예약 등록
            </Button>
            <Card variant="glass" className="flex p-1 gap-1">
              <Button
                variant={view === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('list')}
                className={view === 'list' ? 'bg-brand-600' : ''}
              >
                <List size={14} /> 목록
              </Button>
              <Button
                variant={view === 'calendar' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('calendar')}
                className={view === 'calendar' ? 'bg-brand-600' : ''}
              >
                <Calendar size={14} /> 캘린더
              </Button>
            </Card>
          </div>
        }
      />

      {/* 예약 등록 다이얼로그 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 예약 등록</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">이름</Label>
                <Input
                  value={createForm.name}
                  onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="홍길동"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">전화번호 *</Label>
                <Input
                  type="tel"
                  value={createForm.phone_number}
                  onChange={e => setCreateForm(f => ({ ...f, phone_number: e.target.value }))}
                  placeholder="010-1234-5678"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">예약 날짜 *</Label>
                <Input
                  type="date"
                  value={createForm.booking_date}
                  min={new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })}
                  onChange={e => setCreateForm(f => ({ ...f, booking_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">예약 시간 *</Label>
                <Select value={createForm.booking_time} onValueChange={v => setCreateForm(f => ({ ...f, booking_time: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="시간 선택" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {TIME_OPTIONS.map(val => (
                      <SelectItem key={val} value={val}>{val}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">유입 경로</Label>
                <Select value={createForm.source} onValueChange={v => setCreateForm(f => ({ ...f, source: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="walk-in">방문 (Walk-in)</SelectItem>
                    <SelectItem value="phone">전화 예약</SelectItem>
                    <SelectItem value="kakao">카카오톡</SelectItem>
                    <SelectItem value="naver">네이버 예약</SelectItem>
                    <SelectItem value="referral">지인 소개</SelectItem>
                    <SelectItem value="other">기타</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">메모</Label>
              <Textarea
                value={createForm.notes}
                onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="예약 관련 메모"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>취소</Button>
            <Button onClick={handleCreate} disabled={creating} className="bg-brand-600 hover:bg-brand-700">
              {creating ? '등록 중...' : '예약 등록'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 통계 카드 (클릭 시 필터) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        {[
          { label: '전체 예약', value: stats.total, filter: 'all' },
          { label: '방문완료', value: stats.visited, filter: 'visited' },
          { label: '노쇼', value: stats.noshow, filter: 'noshow' },
          { label: '총 결제액', value: `₩${stats.revenue.toLocaleString()}`, filter: null },
        ].map(({ label, value, filter }) => (
          <Card
            key={label}
            variant="glass"
            className={`p-4 transition-all ${filter !== null ? 'cursor-pointer hover:ring-1 hover:ring-brand-500/30' : ''} ${statusFilter === filter && filter !== 'all' ? 'ring-2 ring-brand-500/50 bg-brand-500/5' : ''}`}
            onClick={() => { if (filter !== null) setStatusFilter(statusFilter === filter ? 'all' : filter) }}
          >
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
            {loading ? <Skeleton className="h-6 mt-1" /> : <p className="text-xl font-bold text-foreground">{value}</p>}
          </Card>
        ))}
      </div>

      {view === 'list' ? (
        <>
          {/* 필터 바 */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Card variant="glass" className="flex items-center px-3 py-1.5 flex-1 max-w-xs min-w-[180px]">
              <Search size={14} className="text-muted-foreground mr-2 shrink-0" />
              <Input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="이름 또는 전화번호"
                className="bg-transparent border-0 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-0 p-0 h-auto"
              />
              {search && (
                <button onClick={() => setSearch('')} className="text-muted-foreground hover:text-foreground shrink-0 ml-1 cursor-pointer">
                  <X size={13} />
                </button>
              )}
            </Card>
            <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} allowFuture bookedDates={bookedDates} />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-auto min-w-[120px] h-9 bg-card border-border dark:border-white/10 text-xs">
                <SelectValue>
                  {statusFilter === 'all'
                    ? `상태 전체`
                    : STATUS_CONFIG[statusFilter]?.label
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">상태 전체 ({bookings.length})</SelectItem>
                {SELECTABLE_STATUSES.map(k => {
                  const v = STATUS_CONFIG[k]
                  return (
                    <SelectItem key={k} value={k}>
                      <span className="flex items-center gap-2">
                        <Badge variant={v.variant} className="text-[10px] px-1.5 py-0">{v.label}</Badge>
                        <span className="text-muted-foreground text-xs">{bookings.filter(b => b.status === k).length}</span>
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            {sourceOptions.length > 0 && (
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-auto min-w-[110px] h-9 bg-card border-border dark:border-white/10 text-xs">
                  <SelectValue>
                    {sourceFilter === 'all' ? '유입경로' : sourceFilter}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">유입경로 전체</SelectItem>
                  {sourceOptions.map(src => (
                    <SelectItem key={src} value={src}>{src}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={paymentFilter} onValueChange={v => setPaymentFilter(v as 'all' | 'paid' | 'unpaid')}>
              <SelectTrigger className="w-auto min-w-[100px] h-9 bg-card border-border dark:border-white/10 text-xs">
                <SelectValue>
                  {paymentFilter === 'all' ? '결제 여부' : paymentFilter === 'paid' ? '결제 완료' : '미결제'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">결제 여부 전체</SelectItem>
                <SelectItem value="paid">결제 완료</SelectItem>
                <SelectItem value="unpaid">미결제</SelectItem>
              </SelectContent>
            </Select>
            <SortSelect
              value={sortBy}
              onValueChange={v => setSortBy(v as typeof sortBy)}
              options={[
                { value: 'newest', label: '최신순' },
                { value: 'oldest', label: '오래된순' },
                { value: 'name', label: '이름순' },
                { value: 'payment', label: '결제액순' },
              ]}
            />
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-3 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setStatusFilter('all')
                  setSourceFilter('all')
                  setPaymentFilter('all')
                  setSearch('')
                  setSortBy('newest')
                }}
              >
                <X size={12} className="mr-1" />
                필터 초기화
              </Button>
            )}
            <span className="text-xs text-muted-foreground ml-auto tabular-nums">
              {filtered.length}건 표시 {filtered.length !== bookings.length && `/ 전체 ${bookings.length}건`}
            </span>
          </div>

          {loading ? (
            <div className="space-y-2">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
          ) : filtered.length === 0 ? (
            <Card variant="glass" className="p-12 text-center">
              <p className="text-muted-foreground text-sm">{search || statusFilter !== 'all' ? '검색 결과가 없습니다.' : '예약 데이터가 없습니다.'}</p>
            </Card>
          ) : (
            <div className="overflow-x-auto">
              {/* 컬럼 헤더 */}
              <Card variant="glass" className="flex items-center gap-4 px-5 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 min-w-[720px]">
                <div className="w-9 shrink-0" />
                <div className="w-40 shrink-0">고객명</div>
                <div className="w-40 shrink-0">예약 일시</div>
                <div className="w-32 shrink-0">유입 경로</div>
                <div className="flex-1" />
                <div className="w-28 shrink-0">예약 상태</div>
                <div className="w-24 shrink-0">상담</div>
                <div className="w-28 shrink-0 text-right">결제 금액</div>
                <div className="w-4 shrink-0" />
              </Card>
              <div className="space-y-2 min-w-[720px]">
                {filtered.map(b => (
                  <BookingRow key={b.id} booking={b} onRefresh={fetchBookings} isSuperAdmin={isSuperAdmin} clinicId={selectedClinicId} isOpen={openBookingId === b.id} onToggle={() => setOpenBookingId(prev => prev === b.id ? null : b.id)} />
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex flex-col lg:flex-row gap-3">
          {/* 좌측: 캘린더 */}
          <Card variant="glass" className="p-6 flex-1 min-w-0">
          {/* 캘린더 헤더: 네비게이션 + 일/주/월 토글 */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => {
                const d = new Date(currentMonth)
                if (calView === 'month') d.setMonth(d.getMonth() - 1)
                else if (calView === 'week') d.setDate(d.getDate() - 7)
                else d.setDate(d.getDate() - 1)
                setCurrentMonth(d)
              }}>
                <ChevronLeft size={16} />
              </Button>
              <h2 className="text-foreground font-semibold text-lg min-w-[140px] text-center">
                {calView === 'day'
                  ? currentMonth.toLocaleDateString('ko', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short' })
                  : calView === 'week'
                    ? `${weekDates[0].toLocaleDateString('ko', { timeZone: 'Asia/Seoul', month: 'short', day: 'numeric' })} — ${weekDates[6].toLocaleDateString('ko', { timeZone: 'Asia/Seoul', month: 'short', day: 'numeric' })}`
                    : currentMonth.toLocaleDateString('ko', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long' })}
              </h2>
              <Button variant="ghost" size="icon" onClick={() => {
                const d = new Date(currentMonth)
                if (calView === 'month') d.setMonth(d.getMonth() + 1)
                else if (calView === 'week') d.setDate(d.getDate() + 7)
                else d.setDate(d.getDate() + 1)
                setCurrentMonth(d)
              }}>
                <ChevronRight size={16} />
              </Button>
              <Button variant="ghost" size="sm" className="ml-2 text-xs" onClick={() => setCurrentMonth(new Date())}>
                오늘
              </Button>
            </div>
            <div className="flex gap-1 bg-muted dark:bg-white/5 rounded-lg p-1">
              {(['month', 'week', 'day'] as const).map(v => (
                <Button
                  key={v}
                  variant={calView === v ? 'default' : 'ghost'}
                  size="sm"
                  className={`text-xs px-3 h-7 ${calView === v ? 'bg-brand-600 hover:bg-brand-700' : ''}`}
                  onClick={() => { setCalView(v); setSelectedDate(null) }}
                >
                  {({ month: '월', week: '주', day: '일' } as const)[v]}
                </Button>
              ))}
            </div>
          </div>

          {/* 월간 뷰 */}
          {calView === 'month' && (
            <>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {DAY_NAMES.map((d, i) => (
                  <div key={d} className={`text-center text-xs py-2 font-medium ${getDayColor(i)}`}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} />)}
                {Array(daysInMonth).fill(null).map((_, i) => {
                  const dayNum = i + 1
                  const dateObj = new Date(year, month, dayNum)
                  const dateKey = dateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
                  const dayOfWeek = dateObj.getDay()
                  const dayBookings = bookingsByDate[dateKey] || []
                  const isToday = todayKey === dateKey
                  const isSelected = selectedDate === dateKey
                  return (
                    <DroppableCell
                      key={dayNum}
                      id={`month-${dateKey}`}
                      dateKey={dateKey}
                      onClick={() => setSelectedDate(isSelected ? null : dateKey)}
                      className={`min-h-[60px] rounded-xl p-1.5 sm:p-2 border transition-all text-left cursor-pointer ${
                        isSelected ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500/30' :
                        isToday ? 'border-brand-500/40 bg-brand-500/5' :
                        'border-border dark:border-white/5 hover:bg-muted dark:hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-medium ${isToday ? 'text-brand-400' : getDayColor(dayOfWeek)}`}>{dayNum}</span>
                        {dayBookings.length > 0 && (
                          <span className="text-[10px] text-muted-foreground bg-muted dark:bg-white/10 rounded-full px-1.5">{dayBookings.length}</span>
                        )}
                      </div>
                      <div className="space-y-0.5">
                        {dayBookings.map((b: any) => {
                          const c = STATUS_CONFIG[b.status] || { label: b.status, variant: 'secondary' as const }
                          return (
                            <DraggableBooking key={b.id} booking={b} variant="month" statusConfig={c} />
                          )
                        })}
                      </div>
                    </DroppableCell>
                  )
                })}
              </div>
            </>
          )}

          {/* 주간 뷰 */}
          {calView === 'week' && (
            <div className="grid grid-cols-7 gap-2">
              {weekDates.map((date, i) => {
                const dateKey = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
                const dayBookings = bookingsByDate[dateKey] || []
                const isToday = todayKey === dateKey
                const isSelected = selectedDate === dateKey
                return (
                  <DroppableCell
                    key={i}
                    id={`week-${dateKey}`}
                    dateKey={dateKey}
                    onClick={() => setSelectedDate(isSelected ? null : dateKey)}
                    className={`rounded-xl p-3 border transition-all text-left min-h-[200px] flex flex-col cursor-pointer ${
                      isSelected ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500/30' :
                      isToday ? 'border-brand-500/40 bg-brand-500/5' :
                      'border-border dark:border-white/5 hover:bg-muted dark:hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="text-center mb-3">
                      <p className={`text-[10px] ${getDayColor(i)}`}>{DAY_NAMES[i]}</p>
                      <p className={`text-lg font-bold ${isToday ? 'text-brand-400' : 'text-foreground'}`}>{date.getDate()}</p>
                      {dayBookings.length > 0 && (
                        <span className="text-[10px] text-muted-foreground">{dayBookings.length}건</span>
                      )}
                    </div>
                    <div className="space-y-1 flex-1 overflow-y-auto">
                      {dayBookings.map((b: any) => {
                        const c = STATUS_CONFIG[b.status] || { label: b.status, variant: 'secondary' as const }
                        return (
                          <DraggableBooking key={b.id} booking={b} variant="week" statusConfig={c} />
                        )
                      })}
                    </div>
                  </DroppableCell>
                )
              })}
            </div>
          )}

          {/* 일간 뷰 */}
          {calView === 'day' && (
            <DayView
              currentMonth={currentMonth}
              bookingsByDate={bookingsByDate}
              todayKey={todayKey}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
          )}

          {/* 범례 */}
          <div className="flex gap-4 mt-4 pt-4 border-t border-border dark:border-white/5 flex-wrap">
            {SELECTABLE_STATUSES.map(k => (
              <div key={k} className="flex items-center gap-1.5">
                <Badge variant={STATUS_CONFIG[k].variant} className="w-2.5 h-2.5 p-0 rounded-full" />
                <span className="text-xs text-muted-foreground">{STATUS_CONFIG[k].label}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* 우측: 선택된 날짜의 예약 상세 패널 */}
        {selectedDate && (
          <Card variant="glass" className="w-full lg:w-[380px] lg:shrink-0 p-5 self-start lg:sticky lg:top-4 max-h-[calc(100vh-8rem)] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-brand-400" />
                <h3 className="text-sm font-semibold text-foreground">
                  {new Date(selectedDate + 'T00:00:00+09:00').toLocaleDateString('ko', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short' })}
                </h3>
                <Badge variant="secondary" className="text-[10px]">
                  {(bookingsByDate[selectedDate] || []).length}건
                </Badge>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedDate(null)}>
                <X size={14} />
              </Button>
            </div>
            {(bookingsByDate[selectedDate] || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">해당 날짜에 예약이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {(bookingsByDate[selectedDate] || []).map((b: any) => {
                  const c = STATUS_CONFIG[b.status] || { label: b.status, variant: 'secondary' as const }
                  const totalPayment = (b.customer?.payments || []).reduce((s: number, p: any) => s + Number(p.payment_amount), 0)
                  return (
                    <div key={b.id} className="rounded-xl bg-muted/50 dark:bg-white/[0.03] border border-border dark:border-white/5 p-3">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 font-bold text-xs shrink-0">
                          {b.customer?.name?.[0] || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{b.customer?.name || '이름 없음'}</p>
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Phone size={9} /> {b.customer?.phone_number}</p>
                        </div>
                        <p className="text-xs font-bold text-foreground shrink-0">{formatTime(b.booking_datetime)}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <div onClick={e => e.stopPropagation()}>
                          <Select value={b.status} disabled={loading} onValueChange={async (newStatus) => {
                            if (newStatus === b.status) return
                            try {
                              const res = await fetch('/api/bookings', {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id: b.id, status: newStatus }),
                              })
                              if (!res.ok) throw new Error()
                              toast.success(`"${STATUS_CONFIG[newStatus]?.label}"(으)로 변경되었습니다.`)
                              fetchBookings()
                            } catch { toast.error('상태 변경 실패') }
                          }}>
                            <SelectTrigger className="h-7 px-2 text-xs border-0 bg-transparent hover:bg-muted dark:hover:bg-white/5 focus:ring-0 w-auto">
                              <Badge variant={c.variant} className="whitespace-nowrap">{c.label}</Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {SELECTABLE_STATUSES.map(k => (
                                <SelectItem key={k} value={k}>
                                  <Badge variant={STATUS_CONFIG[k].variant} className="text-[10px] px-1.5 py-0">{STATUS_CONFIG[k].label}</Badge>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="text-right">
                          {totalPayment > 0
                            ? <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">₩{totalPayment.toLocaleString()}</span>
                            : <span className="text-muted-foreground/60 text-xs">-</span>}
                        </div>
                      </div>
                      {b.notes && (
                        <p className="text-[11px] text-muted-foreground mt-2 pt-2 border-t border-border dark:border-white/5 whitespace-pre-wrap break-words">
                          {b.notes}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        )}
        </div>
        <DragOverlay dropAnimation={{
          duration: 200,
          easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
        }}>
          {draggedBooking && (
            <div className="rounded-xl bg-card border border-brand-500/50 px-3 py-2 shadow-xl shadow-brand-500/10 backdrop-blur-sm min-w-[140px] animate-fade-in-up" style={{ animationDuration: '150ms' }}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-5 h-5 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 font-bold text-[9px] shrink-0">
                  {draggedBooking.customer?.name?.[0] || '?'}
                </div>
                <span className="text-xs font-medium text-foreground truncate">{draggedBooking.customer?.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant={(STATUS_CONFIG[draggedBooking.status] || { variant: 'secondary' }).variant} className="text-[10px] px-1.5 py-0">
                  {(STATUS_CONFIG[draggedBooking.status] || { label: draggedBooking.status }).label}
                </Badge>
                <span className="text-[10px] text-muted-foreground">{formatTime(draggedBooking.booking_datetime)}</span>
              </div>
            </div>
          )}
        </DragOverlay>
        </DndContext>
      )}

      {/* 드래그앤드롭 확인 다이얼로그 */}
      <AlertDialog open={!!dndConfirm} onOpenChange={open => { if (!open) setDndConfirm(null) }}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Calendar size={16} className="text-brand-400" />
              예약 일정 변경
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-1">
                {dndConfirm && (
                  <>
                    {/* 고객 정보 */}
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 font-bold text-xs shrink-0">
                        {dndConfirm.booking.customer?.name?.[0] || '?'}
                      </div>
                      <span className="text-sm font-medium text-foreground">{dndConfirm.booking.customer?.name || '이름 없음'}</span>
                      <Badge variant={(STATUS_CONFIG[dndConfirm.booking.status] || { variant: 'secondary' }).variant} className="text-[10px] ml-auto">
                        {(STATUS_CONFIG[dndConfirm.booking.status] || { label: dndConfirm.booking.status }).label}
                      </Badge>
                    </div>
                    {/* 변경 전 → 후 시각 비교 */}
                    <div className="flex items-center gap-3 rounded-xl bg-muted/50 dark:bg-white/[0.03] border border-border dark:border-white/5 p-3">
                      <div className="flex-1 text-center">
                        <p className="text-[10px] text-muted-foreground mb-0.5">변경 전</p>
                        <p className="text-sm font-semibold text-foreground">
                          {new Date(toUtcDate(dndConfirm.booking.booking_datetime).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }) + 'T00:00:00+09:00')
                            .toLocaleDateString('ko', { timeZone: 'Asia/Seoul', month: 'short', day: 'numeric' })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatTime(dndConfirm.booking.booking_datetime)}
                        </p>
                      </div>
                      <div className="flex flex-col items-center gap-0.5 text-brand-400">
                        <ChevronRight size={16} />
                      </div>
                      <div className="flex-1 text-center">
                        <p className="text-[10px] text-muted-foreground mb-0.5">변경 후</p>
                        <p className="text-sm font-semibold text-brand-400">
                          {new Date(dndConfirm.targetDateKey + 'T00:00:00+09:00')
                            .toLocaleDateString('ko', { timeZone: 'Asia/Seoul', month: 'short', day: 'numeric' })}
                        </p>
                        {dndConfirm.targetMinute !== undefined ? (
                          <p className="text-xs text-brand-400 mt-1">{dndConfirm.selectedTime}</p>
                        ) : (
                          <div className="mt-1" onClick={e => e.stopPropagation()}>
                            <Select
                              value={dndConfirm.selectedTime}
                              onValueChange={v => setDndConfirm(prev => prev ? { ...prev, selectedTime: v } : null)}
                            >
                              <SelectTrigger className="h-7 w-[80px] mx-auto text-xs border-brand-500/30 bg-brand-500/5 text-brand-400 focus:ring-brand-500/30">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="max-h-60">
                                {TIME_OPTIONS.map(val => (
                                  <SelectItem key={val} value={val}>{val}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={executeDndMove}>변경</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
