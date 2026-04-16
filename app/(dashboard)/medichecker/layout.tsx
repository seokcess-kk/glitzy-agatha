import type { Metadata } from 'next'

export const metadata: Metadata = { title: '원고 검수' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
