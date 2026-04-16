import type { Metadata } from 'next'

export const metadata: Metadata = { title: '챗봇' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
