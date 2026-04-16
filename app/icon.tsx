import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 1024, height: 1024 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)',
          borderRadius: '224px',
        }}
      >
        {/* Activity icon (pulse/heartbeat line) */}
        <svg
          width="560"
          height="560"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      </div>
    ),
    { ...size }
  )
}
