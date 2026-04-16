'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Activity, AlertCircle, Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-background">
        <Loader2 size={32} className="animate-spin text-brand-600" />
      </div>
    }>
      <SignupContent />
    </Suspense>
  )
}

function SignupContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [validating, setValidating] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [clientName, setClientName] = useState('')
  const [tokenError, setTokenError] = useState('')

  const [name, setName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showPwConfirm, setShowPwConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  // 토큰 검증
  useEffect(() => {
    if (!token) {
      setTokenError('초대 링크가 올바르지 않습니다.')
      setValidating(false)
      return
    }

    fetch(`/api/auth/signup/validate?token=${encodeURIComponent(token)}`)
      .then(res => res.json())
      .then(data => {
        if (data.valid) {
          setTokenValid(true)
          setClientName(data.clientName)
        } else {
          setTokenError(data.error || '유효하지 않은 초대 링크입니다.')
        }
      })
      .catch(() => {
        setTokenError('토큰 검증 중 오류가 발생했습니다.')
      })
      .finally(() => setValidating(false))
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('이름을 입력해주세요.')
      return
    }

    if (!phoneNumber.trim()) {
      setError('휴대폰 번호를 입력해주세요.')
      return
    }

    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.')
      return
    }

    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name, phone_number: phoneNumber, password }),
      })
      const data = await res.json()
      if (res.ok) {
        setSuccess(true)
      } else {
        setError(data.error || '회원가입에 실패했습니다.')
      }
    } catch {
      setError('회원가입 처리 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 성공 화면
  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-slate-50 dark:bg-background">
        <div className="w-full max-w-[400px]">
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 bg-brand-600 rounded-xl flex items-center justify-center mb-3">
              <Activity size={24} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Agatha</h1>
            <p className="text-sm text-slate-400 mt-1">Marketing Intelligence</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 text-center">
            <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-2">가입이 완료되었습니다</h2>
            <p className="text-sm text-slate-500 mb-6">이제 로그인하여 서비스를 이용할 수 있습니다.</p>
            <Link href="/login">
              <Button className="w-full bg-brand-600 hover:bg-brand-700 text-white rounded-lg">
                로그인하기
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-slate-50 dark:bg-background">
      <div className="w-full max-w-[400px]">
        {/* 로고 */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-brand-600 rounded-xl flex items-center justify-center mb-3">
            <Activity size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Agatha</h1>
          <p className="text-sm text-slate-400 mt-1">Marketing Intelligence</p>
        </div>

        {/* 로딩 */}
        {validating && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 text-center">
            <Loader2 size={32} className="animate-spin text-brand-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500">초대 링크를 확인하고 있습니다...</p>
          </div>
        )}

        {/* 토큰 에러 */}
        {!validating && !tokenValid && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 text-center">
            <AlertCircle size={48} className="text-rose-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-2">초대 링크 오류</h2>
            <p className="text-sm text-slate-500 mb-6">{tokenError}</p>
            <Link href="/login">
              <Button variant="outline" className="w-full rounded-lg">
                로그인 페이지로 이동
              </Button>
            </Link>
          </div>
        )}

        {/* 회원가입 폼 */}
        {!validating && tokenValid && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
            <p className="text-sm text-slate-500 text-center mb-6">
              <span className="font-semibold text-slate-700 dark:text-slate-200">{clientName}</span>에 초대되었습니다
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm text-slate-700 dark:text-slate-200 font-medium">
                  이름
                </Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="홍길동"
                  required
                  autoComplete="name"
                  className="border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone_number" className="text-sm text-slate-700 dark:text-slate-200 font-medium">
                  휴대폰 번호
                </Label>
                <Input
                  id="phone_number"
                  type="text"
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                  placeholder="010-0000-0000"
                  required
                  autoComplete="tel"
                  className="border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm text-slate-700 dark:text-slate-200 font-medium">
                  비밀번호
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="8자 이상"
                    required
                    autoComplete="new-password"
                    className="pr-10 border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                  >
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password_confirm" className="text-sm text-slate-700 dark:text-slate-200 font-medium">
                  비밀번호 확인
                </Label>
                <div className="relative">
                  <Input
                    id="password_confirm"
                    type={showPwConfirm ? 'text' : 'password'}
                    value={passwordConfirm}
                    onChange={e => setPasswordConfirm(e.target.value)}
                    placeholder="비밀번호 재입력"
                    required
                    autoComplete="new-password"
                    className="pr-10 border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowPwConfirm(v => !v)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                  >
                    {showPwConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                  </Button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                  <AlertCircle size={14} className="shrink-0" />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-600 hover:bg-brand-700 text-white rounded-lg"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin mr-2" />
                    가입 중...
                  </>
                ) : (
                  '가입하기'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-slate-500">
                이미 계정이 있으신가요?{' '}
                <Link href="/login" className="text-brand-600 hover:text-brand-700 font-medium">
                  로그인
                </Link>
              </p>
            </div>
          </div>
        )}

        {/* 하단 링크 */}
        <div className="flex items-center justify-center gap-3 mt-6 text-xs text-slate-400">
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-slate-600 transition-colors">
            개인정보처리방침
          </a>
          <span>·</span>
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-slate-600 transition-colors">
            이용약관
          </a>
        </div>
      </div>
    </div>
  )
}
