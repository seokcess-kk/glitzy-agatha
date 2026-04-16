# Samantha Brand Guide

## 서비스 정보

| 항목 | 값 |
|------|---|
| 서비스명 | **Samantha** |
| 정식 명칭 | Samantha — Medical Marketing Intelligence |
| 약칭 | Samantha (내부/코드 동일) |
| 대상 | 병원 마케팅 담당자, 에이전시, 병원 관리자 |
| 성격 | B2B SaaS 대시보드, 데이터 인텔리전스 |
| 톤앤매너 | 전문적 + 따뜻함 (Samantha라는 이름의 인간적 느낌) |

## 컬러 시스템

### Core Palette

```
Primary (Blue) — 신뢰, 전문성
  50:  #eff6ff
  100: #dbeafe
  400: #60a5fa
  500: #3b82f6  ← 메인
  600: #2563eb
  700: #1d4ed8

Secondary (Violet) — 인텔리전스, 프리미엄
  50:  #f5f3ff
  100: #ede9fe
  400: #a78bfa
  500: #8b5cf6  ← 보조
  600: #7c3aed
  700: #6d28d9

Accent (Emerald) — 성장, 긍정 지표
  50:  #ecfdf5
  100: #d1fae5
  400: #34d399
  500: #10b981  ← 강조/CTA
  600: #059669
```

### Semantic Colors

| 용도 | 컬러 | 코드 |
|------|------|------|
| 긍정 지표 (매출↑, ROAS↑) | Emerald | `#10b981` |
| 부정 지표 (이탈↑, 비용↑) | Rose | `#f43f5e` |
| 경고 | Amber | `#f59e0b` |
| 정보 | Sky | `#0ea5e9` |

### 다크모드 배경

- Background: `hsl(228, 12%, 8%)`
- 글로우 효과: `brand-600/10` + `violet-500/5` 그라디언트

## 로고

### 심볼 컨셉

- **A안 확정**: S자 곡선 = 데이터 흐름 + 성장 그래프
- 두 줄기가 수렴하는 S 형태 (인사이트 수렴 의미)
- 심볼 단독(파비콘) + 심볼+워드마크(사이드바/로그인) 조합

### 심볼 제작 가이드

- 최소 크기: 16x16px에서 식별 가능해야 함
- 단색 버전 필요 (흰색, 검정, 브랜드 블루)
- 라운드 사각형 배경 (borderRadius: 22%)
- Primary Blue (#3b82f6) → Secondary Violet (#8b5cf6) 그라디언트 배경
- S 심볼: White (#ffffff)

### 워드마크

- 폰트: Inter 또는 유사한 Geometric Sans-Serif
- 웨이트: SemiBold (600)
- 자간: -0.02em (약간 타이트)
- "Samantha" 전체 또는 "samantha" 소문자

## 타이포그래피

- Primary: Inter (Google Fonts)
- Fallback: system-ui, -apple-system, sans-serif
- Weights: 400 (body), 500 (label), 600 (heading), 700 (emphasis)

## 적용 계획

### 즉시 적용 (로고 무관)
- [x] 페이지별 브라우저 탭 제목

### 로고 확정 후 적용
- [ ] 파비콘 (icon.tsx) → 심볼 기반 재생성
- [ ] Apple 아이콘 (apple-icon.tsx) → 심볼 기반
- [ ] 사이드바 로고 (Sidebar.tsx) → 심볼 + 워드마크
- [ ] 로그인 페이지 로고
- [ ] 컬러 마이그레이션 (Indigo → Blue 기반)
  - tailwind.config.ts brand 색상
  - globals.css CSS 변수 (--primary, --ring)
  - 하드코딩 색상 업데이트
