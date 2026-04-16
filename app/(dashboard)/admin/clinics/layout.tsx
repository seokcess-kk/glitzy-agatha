import type { Metadata } from 'next'

export const metadata: Metadata = { title: '병원 관리' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
