'use client'
import { useState, useEffect } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Activity, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [phoneNumber, setPhoneNumber] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (session) router.replace('/')
  }, [session, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await signIn('credentials', { phone_number: phoneNumber, password, redirect: false })
    if (result?.ok) {
      router.replace('/')
    } else {
      if (result?.error === 'RATE_LIMITED') {
        setError('로그인 시도 횟수를 초과했습니다. 15분 후 다시 시도해주세요.')
      } else {
        setError('휴대폰 번호 또는 비밀번호가 올바르지 않습니다.')
      }
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-slate-50 dark:bg-background">
      <div className="w-full max-w-[400px]">
        {/* 로고 — 카드 위 중앙 */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-brand-600 rounded-xl flex items-center justify-center mb-3">
            <Activity size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Agatha</h1>
          <p className="text-sm text-slate-400 mt-1">Marketing Intelligence</p>
        </div>

        {/* 로그인 카드 */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone_number" className="text-sm text-slate-700 dark:text-slate-200 font-medium">
                휴대폰 번호
              </Label>
              <Input
                id="phone_number"
                type="text"
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                placeholder="01012345678"
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
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
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
                  로그인 중...
                </>
              ) : (
                '로그인하기'
              )}
            </Button>
          </form>

          {/* 회원가입 */}
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500 mb-2">초대받으셨나요?</p>
            <Link href="/signup">
              <Button variant="ghost" className="text-slate-700 dark:text-slate-200 w-full">
                회원가입
              </Button>
            </Link>
          </div>
        </div>

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
