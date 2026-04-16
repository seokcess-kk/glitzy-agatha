import type { Metadata } from 'next'
import { GeistMono } from 'geist/font/mono'
import Providers from '@/components/Providers'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Agatha — Marketing Intelligence',
    template: '%s | Agatha',
  },
  description: '광고 성과를 하나의 대시보드에서. Data in, Growth out.',
  openGraph: {
    title: 'Agatha — Marketing Intelligence',
    description: '광고 성과를 하나의 대시보드에서. Data in, Growth out.',
    siteName: 'Agatha',
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Agatha — Marketing Intelligence',
    description: '광고 성과를 하나의 대시보드에서. Data in, Growth out.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={GeistMono.variable} suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
      </head>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
