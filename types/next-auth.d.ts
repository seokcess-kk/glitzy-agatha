import 'next-auth'
import 'next-auth/jwt'

// 사용자 역할 타입
type UserRole = 'superadmin' | 'client_admin' | 'client_staff' | 'agency_staff' | 'demo_viewer'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      phone_number: string
      role: UserRole
      client_id: number | null
      password_version: number
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }

  interface User {
    id: string
    role: UserRole
    client_id: number | null
    phone_number: string
    password_version: number
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    sub?: string
    role: UserRole
    client_id: number | null
    phone_number: string
    password_version: number
  }
}
