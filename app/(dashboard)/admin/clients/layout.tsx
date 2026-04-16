import type { Metadata } from 'next'

export const metadata: Metadata = { title: '클라이언트 관리' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
