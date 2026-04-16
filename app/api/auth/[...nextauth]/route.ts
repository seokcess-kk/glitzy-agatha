import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'
import { headers } from 'next/headers'
import { setRequestContext } from '@/lib/auth'

// IP/UA를 모듈 레벨 변수로 전달하는 래퍼
async function injectRequestContext() {
  const h = headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim()
    || h.get('x-real-ip')
    || '127.0.0.1'
  const ua = h.get('user-agent') || ''
  setRequestContext(ip, ua)
}

const handler = NextAuth(authOptions)

async function wrappedHandler(req: Request, context: any) {
  await injectRequestContext()
  return handler(req, context)
}

export { wrappedHandler as GET, wrappedHandler as POST }
