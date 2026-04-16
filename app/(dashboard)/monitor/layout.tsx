import type { Metadata } from 'next'

export const metadata: Metadata = { title: '콘텐츠 모니터링' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
