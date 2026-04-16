# Glitzy Icon Family Guide

Glitzy 패밀리 서비스(Glitzy-web, Agatha, Samantha)의 favicon, apple-icon, OG 이미지 통일 가이드.

## 패밀리 디자인 원칙

| 요소 | 공통 규칙 |
|------|----------|
| 배경 | `#050505` (거의 블랙) |
| 파비콘 심볼 | **서비스 이니셜 1글자** (SVG 아이콘 X) |
| 레터 스타일 | `fontWeight: 700`, `letterSpacing: -0.02em` |
| 아이콘 라운딩 | favicon `6px`, apple-icon `40px` (22%) |
| OG 레이아웃 | Brutalist dark — 좌측 accent strip + 대형 타이포 + 워터마크 |
| OG 하단 | 서비스명 + "by Glitzy" 또는 "glitzy.kr" |

## 서비스별 매핑

| 서비스 | 이니셜 | 액센트 컬러 | OG 헤드라인 | OG 워터마크 |
|--------|--------|------------|------------|-------------|
| **Glitzy-web** | G | `#FF3E00` (Orange) | NO STRUCTURE NO GROWTH. | STRUCTURE. |
| **Agatha** | A | `#7C3AED` (Violet) | DATA IN GROWTH OUT. | INTEL. |
| **Samantha** | S | `#3B82F6` (Blue) | *(아래 참고)* | *(아래 참고)* |

---

## Samantha 적용 가이드

### 현재 상태 (변경 필요)

- `app/icon.tsx`: 파란 그라데이션 + Activity SVG → **제거**
- `app/apple-icon.tsx`: 동일 → **제거**
- `app/opengraph-image.tsx`: **없음** → 신규 생성
- `app/layout.tsx`: OG/Twitter 메타데이터 **없음** → 추가

### 1. `app/icon.tsx` — Favicon (32x32)

```tsx
import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 32, height: 32 }
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
          backgroundColor: '#050505',
          borderRadius: '6px',
        }}
      >
        <span
          style={{
            fontSize: '22px',
            fontWeight: 700,
            color: '#3B82F6',
            letterSpacing: '-0.02em',
          }}
        >
          S
        </span>
      </div>
    ),
    { ...size }
  )
}
```

### 2. `app/apple-icon.tsx` — Apple Touch Icon (180x180)

```tsx
import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#050505',
          borderRadius: '40px',
        }}
      >
        <span
          style={{
            fontSize: '120px',
            fontWeight: 700,
            color: '#3B82F6',
            letterSpacing: '-0.02em',
          }}
        >
          S
        </span>
      </div>
    ),
    { ...size }
  )
}
```

### 3. `app/opengraph-image.tsx` — OG Image (1200x630)

```tsx
import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Samantha — Medical Marketing Intelligence'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const colors = {
  background: '#050505',
  accent: '#3B82F6',
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
            color: 'rgba(59, 130, 246, 0.06)',
            letterSpacing: '-0.04em',
            lineHeight: 1,
            display: 'flex',
          }}
        >
          CLINIC.
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
              Medical Marketing Intelligence
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
              <span style={{ display: 'flex' }}>PATIENTS</span>
              <span style={{ display: 'flex' }}>
                FIRST
                <span style={{ color: colors.accent, marginLeft: 24 }}>
                  ALWAYS.
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
              병원 마케팅, 데이터로 진단합니다.
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
                SAMANTHA
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
```

### 4. `app/layout.tsx` — metadata 수정

```tsx
export const metadata: Metadata = {
  title: {
    default: 'Samantha — Medical Marketing Intelligence',
    template: '%s | Samantha',
  },
  description: '병원 마케팅, 데이터로 진단합니다. Patients first, always.',
  openGraph: {
    title: 'Samantha — Medical Marketing Intelligence',
    description: '병원 마케팅, 데이터로 진단합니다. Patients first, always.',
    siteName: 'Samantha',
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Samantha — Medical Marketing Intelligence',
    description: '병원 마케팅, 데이터로 진단합니다. Patients first, always.',
  },
}
```

---

## 비주얼 패밀리 비교

```
┌─────────────┬─────────────┬─────────────┐
│  Glitzy-web │   Agatha    │  Samantha   │
│  ┌───────┐  │  ┌───────┐  │  ┌───────┐  │
│  │ ■■■■■ │  │  │ ■■■■■ │  │  │ ■■■■■ │  │
│  │ ■ G ■ │  │  │ ■ A ■ │  │  │ ■ S ■ │  │
│  │ ■■■■■ │  │  │ ■■■■■ │  │  │ ■■■■■ │  │
│  └───────┘  │  └───────┘  │  └───────┘  │
│  #FF3E00    │  #7C3AED    │  #3B82F6    │
│  Orange     │  Violet     │  Blue       │
└─────────────┴─────────────┴─────────────┘
  배경: 전부 #050505 (거의 블랙)
```

## 체크리스트

- [ ] `app/icon.tsx` — 다크 배경 + "S" 레터 (Blue)
- [ ] `app/apple-icon.tsx` — 동일 스타일 180x180
- [ ] `app/opengraph-image.tsx` — Brutalist OG (신규)
- [ ] `app/layout.tsx` — OG/Twitter metadata 추가
- [ ] `npm run build` 통과 확인
- [ ] 브라우저에서 favicon 렌더링 확인
