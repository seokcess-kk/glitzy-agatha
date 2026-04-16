'use client'
import { useState, useEffect } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Activity, AlertCircle, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [username, setUsername] = useState('')
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
    const result = await signIn('credentials', { username, password, redirect: false })
    if (result?.ok) {
      router.replace('/')
    } else {
      if (result?.error === 'RATE_LIMITED') {
        setError('로그인 시도 횟수를 초과했습니다. 15분 후 다시 시도해주세요.')
      } else {
        setError('아이디 또는 비밀번호가 올바르지 않습니다.')
      }
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* 배경 장식 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-brand-600/20 via-transparent to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-purple-600/10 via-transparent to-transparent rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* 로고 */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-brand-600/30">
            <Activity size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Agatha</h1>
          <p className="text-sm text-muted-foreground mt-1">Marketing Intelligence</p>
        </div>

        {/* 로그인 폼 */}
        <Card variant="glass" className="p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-foreground">로그인</h2>
            <p className="text-sm text-muted-foreground mt-1">계정 정보를 입력하여 로그인하세요</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-xs text-muted-foreground font-medium">아이디</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="admin"
                required
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs text-muted-foreground font-medium">비밀번호</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-white/10"
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </Button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                <AlertCircle size={14} className="shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 hover:bg-brand-700"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin mr-2" />
                  로그인 중...
                </>
              ) : (
                '로그인'
              )}
            </Button>
          </form>
        </Card>

        {/* 푸터 */}
        <div className="text-center mt-6 space-y-2">
          <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground/60">
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-muted-foreground transition-colors">
              개인정보처리방침
            </a>
            <span>·</span>
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-muted-foreground transition-colors">
              서비스 이용약관
            </a>
          </div>
          <p className="text-xs text-muted-foreground/60">
            &copy; 2026 Glitzy. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}
