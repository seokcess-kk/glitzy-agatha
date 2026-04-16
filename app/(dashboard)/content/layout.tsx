import type { Metadata } from 'next'

export const metadata: Metadata = { title: '콘텐츠 분석' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
