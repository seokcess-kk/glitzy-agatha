import type { Metadata } from 'next'

export const metadata: Metadata = { title: '랜딩 페이지' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
