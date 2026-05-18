import bundleAnalyzer from '@next/bundle-analyzer'

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      // /campaigns 폐기 (2026-05-18) — /ads 의 캠페인 분석 탭과 데이터 중복.
      // 기존 북마크/외부 링크 보호 위해 영구 리다이렉트.
      { source: '/campaigns', destination: '/ads?tab=campaigns', permanent: true },
      { source: '/campaigns/:path*', destination: '/ads?tab=campaigns', permanent: true },
    ]
  },
}

export default withBundleAnalyzer(nextConfig)
