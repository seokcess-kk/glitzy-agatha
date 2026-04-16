'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'

function LandingPageIframe() {
  const searchParams = useSearchParams()
  const lpId = searchParams.get('id')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!lpId) {
      setError('랜딩 페이지 ID가 필요합니다.')
      return
    }

    fetch(`/api/lp/meta?id=${encodeURIComponent(lpId)}`)
      .then(res => res.json())
      .then(data => {
        if (data.name) {
          document.title = data.name
        }
      })
      .catch(() => {})
  }, [lpId])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">페이지를 찾을 수 없습니다</h1>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    )
  }

  if (!lpId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <p className="text-gray-400">로딩 중...</p>
        </div>
      </div>
    )
  }

  const allParams = searchParams.toString()

  return (
    <iframe
      src={`/api/lp/render?${allParams}`}
      className="w-full h-screen border-0"
      title="Landing Page"
    />
  )
}

export default function LandingPageContent() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <p className="text-gray-400">로딩 중...</p>
      </div>
    }>
      <LandingPageIframe />
    </Suspense>
  )
}
