import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Agatha — Marketing Intelligence'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const colors = {
  background: '#050505',
  accent: '#7C3AED',
  text1: '#F8FAFC',
  text2: 'rgba(248,250,252,0.55)',
  text3: 'rgba(248,250,252,0.35)',
}

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: colors.background,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 배경 워터마크 — 우하단 */}
        <div
          style={{
            position: 'absolute',
            right: -40,
            bottom: -100,
            fontSize: 300,
            fontWeight: 700,
            color: 'rgba(124, 58, 237, 0.06)',
            letterSpacing: '-0.04em',
            lineHeight: 1,
            display: 'flex',
          }}
        >
          INTEL.
        </div>

        {/* 좌측 accent strip */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: 6,
            backgroundColor: colors.accent,
            display: 'flex',
          }}
        />

        {/* 외곽 border */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
          }}
        />

        {/* 콘텐츠 컨테이너 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            flex: 1,
            padding: '72px 90px 64px 96px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* 상단: eyebrow */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div
              style={{
                width: 36,
                height: 1,
                backgroundColor: colors.accent,
                display: 'flex',
              }}
            />
            <span
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: colors.accent,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
              }}
            >
              Marketing Intelligence
            </span>
          </div>

          {/* 중앙: 헤드라인 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 28,
            }}
          >
            <h1
              style={{
                fontSize: 116,
                fontWeight: 700,
                color: colors.text1,
                lineHeight: 0.95,
                margin: 0,
                letterSpacing: '-0.035em',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <span style={{ display: 'flex' }}>DATA IN</span>
              <span style={{ display: 'flex' }}>
                GROWTH{' '}
                <span style={{ color: colors.accent, marginLeft: 24 }}>
                  OUT.
                </span>
              </span>
            </h1>
            <p
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: colors.text2,
                margin: 0,
                letterSpacing: '-0.01em',
              }}
            >
              광고 성과를 하나의 대시보드에서.
            </p>
          </div>

          {/* 하단: 로고 + URL */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <span
                style={{
                  fontSize: 36,
                  fontWeight: 700,
                  color: colors.text1,
                  letterSpacing: '-0.02em',
                }}
              >
                AGATHA
              </span>
              <span
                style={{
                  fontSize: 16,
                  color: colors.text3,
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                }}
              >
                by Glitzy
              </span>
            </div>
            <span
              style={{
                fontSize: 22,
                color: colors.text2,
                fontWeight: 700,
                letterSpacing: '0.02em',
              }}
            >
              glitzy.kr
            </span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
