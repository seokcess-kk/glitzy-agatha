import type { NextAuthOptions, User } from 'next-auth'
import type { JWT } from 'next-auth/jwt'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { serverSupabase } from './supabase'
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from './rate-limit'
import { createLogger } from './logger'

const logger = createLogger('Auth')

// 사용자 역할 타입
type UserRole = 'superadmin' | 'clinic_admin' | 'clinic_staff' | 'agency_staff' | 'demo_viewer'

// 확장된 User 타입
interface ExtendedUser extends User {
  role: UserRole
  clinic_id: number | null
  username: string
  password_version: number
}

// 모듈 레벨 요청 컨텍스트 (route.ts에서 주입)
let _requestIp = '127.0.0.1'
let _requestUa = ''

export function setRequestContext(ip: string, ua: string) {
  _requestIp = ip
  _requestUa = ua
}

/**
 * 로그인 로그를 non-blocking으로 기록
 */
async function insertLoginLog(params: {
  userId: number | null
  username: string
  ip: string
  ua: string
  success: boolean
  failureReason?: string
}) {
  try {
    const supabase = serverSupabase()
    await supabase.from('login_logs').insert({
      user_id: params.userId,
      username: params.username,
      ip_address: params.ip,
      user_agent: params.ua,
      success: params.success,
      failure_reason: params.failureReason || null,
    })
  } catch (e) {
    logger.warn('로그인 로그 기록 실패', { error: e })
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials): Promise<ExtendedUser | null> {
        if (!credentials?.username || !credentials?.password) return null

        const ip = _requestIp
        const ua = _requestUa
        const username = credentials.username

        // Rate limit 체크
        const rateCheck = checkRateLimit(ip, username)
        if (rateCheck.limited) {
          insertLoginLog({ userId: null, username, ip, ua, success: false, failureReason: 'rate_limited' })
          throw new Error('RATE_LIMITED')
        }

        // DB 사용자 조회
        const supabase = serverSupabase()
        const { data: user } = await supabase
          .from('users')
          .select('*')
          .eq('username', username)
          .eq('is_active', true)
          .single()

        if (!user) {
          recordFailedAttempt(ip, username)
          insertLoginLog({ userId: null, username, ip, ua, success: false, failureReason: 'user_not_found' })
          return null
        }

        const valid = await bcrypt.compare(credentials.password, user.password_hash)
        if (!valid) {
          recordFailedAttempt(ip, username)
          insertLoginLog({ userId: user.id, username, ip, ua, success: false, failureReason: 'invalid_password' })
          return null
        }

        // 성공 → rate limit 리셋 + 로그 기록
        resetRateLimit(ip, username)
        insertLoginLog({ userId: user.id, username, ip, ua, success: true })

        return {
          id: String(user.id),
          name: user.username,
          email: `${user.username}@samantha.local`,
          role: user.role as UserRole,
          clinic_id: user.clinic_id,
          username: user.username,
          password_version: user.password_version ?? 1,
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }): JWT {
      if (user) {
        const extUser = user as ExtendedUser
        token.role = extUser.role
        token.clinic_id = extUser.clinic_id
        token.username = extUser.username || extUser.name || ''
        token.password_version = extUser.password_version
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub || ''
        session.user.role = token.role
        session.user.clinic_id = token.clinic_id
        session.user.username = token.username
        session.user.password_version = token.password_version
      }
      return session
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60,        // 1시간 (의료 시스템에 적절)
    updateAge: 15 * 60,     // 15분마다 세션 갱신
  },
  pages: { signIn: '/login' },
  secret: process.env.NEXTAUTH_SECRET,
}
