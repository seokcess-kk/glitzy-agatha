# Phase 1: 초기 설정 및 UI/UX 개선

> 기간: ~2026-03-14 | 상태: 완료/동결

shadcn/ui 기반 UI/UX 개선, 코드 품질, 접근성, 번들 최적화, 문서화 작업 기록

---

## Phase 1: shadcn/ui 초기 설정

### 설치 패키지
```bash
npx shadcn@latest init
npm install tailwindcss-animate class-variance-authority clsx tailwind-merge
```

### 설정 파일 수정

**tailwind.config.ts**
- shadcn 색상 시스템 통합 (border, background, foreground, primary 등)
- 기존 brand 색상 유지 (brand-50 ~ brand-900)
- CSS 변수 기반 테마 시스템

**app/globals.css**
- CSS 변수 정의 (:root)
- 다크 테마 기본값 설정
- glass-card, animate-fade-in-up 유지

**lib/utils.ts**
- `cn()` 유틸리티 함수 생성 (clsx + tailwind-merge)

---

## Phase 2: UI 컴포넌트 추가

### 설치된 shadcn/ui 컴포넌트
```
components/ui/
├── button.tsx      # glass variant 추가
├── badge.tsx       # 채널별 variant (meta, google, tiktok, naver, kakao)
├── card.tsx        # glass variant 추가
├── input.tsx       # 다크 테마 기본 적용
├── select.tsx      # 다크 테마 기본 적용
├── label.tsx
├── skeleton.tsx
├── table.tsx
├── tabs.tsx        # 다크 테마 기본 적용
├── dialog.tsx
├── sheet.tsx
├── dropdown-menu.tsx
└── sonner.tsx
```

### 컴포넌트 커스터마이징

**Button** - glass variant
```tsx
glass: "glass-card hover:bg-white/10 text-slate-400 hover:text-white"
```

**Badge** - 채널/상태 variants
```tsx
meta: "bg-blue-500/20 text-blue-400 border-blue-500/30"
google: "bg-red-500/20 text-red-400 border-red-500/30"
success: "bg-emerald-500/20 text-emerald-400"
warning: "bg-amber-500/20 text-amber-400"
```

**Input/Select/Tabs** - 다크 테마 기본 적용
```tsx
// Input
"border-white/10 bg-white/5 text-white placeholder:text-slate-500"

// Select
"bg-[#1a1a2e]/95 backdrop-blur-xl border-white/10"
```

---

## Phase 3: 공통 컴포넌트 생성

### 디렉토리 구조
```
components/common/
├── index.ts           # 통합 export
├── page-header.tsx    # 페이지 헤더 (title, description, actions)
├── stats-card.tsx     # 통계 카드 (label, value, trend, icon)
├── channel-badge.tsx  # 채널 자동 감지 뱃지
├── status-badge.tsx   # 상태 자동 감지 뱃지
└── empty-state.tsx    # 빈 상태 표시
```

### 사용 현황
| 컴포넌트 | 사용 페이지 수 |
|----------|----------------|
| PageHeader | 8 |
| StatsCard | 6 |
| ChannelBadge | 4 |
| StatusBadge | 3 |
| EmptyState | 2 |

---

## Phase 4: 페이지별 적용

### 적용 완료 페이지

| 페이지 | 파일 | 주요 변경 |
|--------|------|-----------|
| 로그인 | `login/page.tsx` | Card, Input, Button, Label |
| 대시보드 | `page.tsx` | Card, Button, Badge, Table, Skeleton, 차트 래퍼 |
| 고객(CDP) | `leads/page.tsx` | Card, Badge, Sheet, Select, Input |
| 리드 폼 | `lead-form/page.tsx` | Card, Input, Select, Button |
| 광고 분석 | `ads/page.tsx` | Card, Badge, Button, Select, 차트 래퍼 |
| 예약/결제 | `patients/page.tsx` | Card, Tabs, Badge, Dialog |
| 콘텐츠 | `content/page.tsx` | Card, Dialog, Table, 차트 래퍼 |
| 어드민 | `admin/page.tsx` | Tabs, Dialog, Table, Input, Select |
| 챗봇 | `chatbot/page.tsx` | Card, Badge, Table |
| 모니터 | `monitor/page.tsx` | Card, Table, Button |
| 언론보도 | `press/page.tsx` | Card, Badge, EmptyState |
| UTM 생성기 | `utm/page.tsx` | Card, Input, Select, Button |

### Sidebar 업데이트
- DropdownMenu 적용
- Select 컴포넌트 (병원 선택)

---

## Phase 5: 코드 품질 개선

### ESLint 경고 수정 (0 errors, 0 warnings)

| 파일 | 문제 | 해결 |
|------|------|------|
| `admin/page.tsx` | useEffect 의존성 누락 | `router` 추가 |
| `ads/page.tsx` | useEffect 의존성 누락 | `useCallback` 적용 |
| `layout.tsx` | Google Fonts CDN 경고 | `next/font/google` 사용 |
| `channel-badge.tsx` | 타입 불일치 | `NonNullable<BadgeProps['variant']>` 사용 |

### 타입 안전성 개선
- tickFormatter 콜백에 `(v: number)` 타입 명시
- 차트 컴포넌트 `ComponentType<any>` 캐스팅

---

## Phase 6: 접근성 개선

### ARIA 속성 추가

| 파일 | 요소 | 추가된 속성 |
|------|------|-------------|
| `layout.tsx` | 모바일 메뉴 버튼 | `aria-label="메뉴 열기"` |
| `admin/page.tsx` | 토글 버튼 | `aria-label` (동적) |
| `monitor/page.tsx` | 펼치기/접기 버튼 | `aria-label`, `aria-expanded` |
| `leads/page.tsx` | 필터 버튼 | `aria-pressed`, `aria-label` |
| `leads/page.tsx` | 고객 선택 버튼 | `aria-pressed`, `aria-label` |
| `patients/page.tsx` | 아코디언 | `aria-expanded`, `aria-label` |
| `utm/page.tsx` | 히스토리 토글 | `aria-expanded`, `aria-label` |
| `utm/page.tsx` | 삭제 버튼 | `aria-label` (동적) |
| `Sidebar.tsx` | 사용자 메뉴 | `aria-label="사용자 메뉴"` |

---

## Phase 7: 모바일 UX 개선

### 반응형 그리드 수정

| 파일 | 이전 | 이후 |
|------|------|------|
| `chatbot/page.tsx` | `grid-cols-3` | `grid-cols-1 sm:grid-cols-3` |
| `press/page.tsx` | `grid-cols-3` | `grid-cols-1 sm:grid-cols-3` |
| `leads/page.tsx` | `grid-cols-5` | `grid-cols-3 sm:grid-cols-5` |
| `content/page.tsx` | `grid-cols-5` | `grid-cols-2 sm:grid-cols-5` |
| `patients/page.tsx` | `min-h-[80px]` | `min-h-[60px] sm:min-h-[80px]` |

### 터치 타겟 개선
- `layout.tsx`: 모바일 메뉴 버튼 `p-1.5` → `p-2.5`

### 버그 수정
- `leads/page.tsx`: Sheet 모달 데스크톱 오버레이 버그 수정
  - `SheetContent`에만 `md:hidden` 적용 → `Sheet` 전체를 `<div className="md:hidden">`으로 감싸기

---

## Phase 8: 번들 최적화

### 분석 도구 설치
```bash
npm install @next/bundle-analyzer --save-dev
```

**next.config.mjs**
```javascript
import bundleAnalyzer from '@next/bundle-analyzer'

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

export default withBundleAnalyzer(nextConfig)
```

**package.json**
```json
"scripts": {
  "analyze": "ANALYZE=true next build"
}
```

### 차트 래퍼 컴포넌트

**components/charts/index.tsx**
```tsx
// Dynamic Import (코드 스플리팅)
export const AreaChart = dynamic(
  () => import('recharts').then(mod => mod.AreaChart),
  { ssr: false, loading: () => <ChartLoading /> }
)
export const BarChart = dynamic(...)
export const PieChart = dynamic(...)
export const LineChart = dynamic(...)
export const ResponsiveContainer = dynamic(...)

// 직접 Re-export (자식 컴포넌트)
export { Area, Bar, Line, Pie, Cell, XAxis, YAxis, ... } from 'recharts'
```

### 번들 크기 개선 결과

| 페이지 | 이전 | 이후 | 절감 |
|--------|------|------|------|
| `/` (대시보드) | 213 kB | 191 kB | -22 kB (-10%) |
| `/ads` | 249 kB | 237 kB | -12 kB (-5%) |
| `/content` | 238 kB | 225 kB | -13 kB (-5%) |

---

## Phase 9: 문서화

### 생성된 문서

| 파일 | 내용 |
|------|------|
| `docs/API.md` | REST API 엔드포인트 문서 (26개 API) |
| `docs/COMPONENTS.md` | UI 컴포넌트 사용 가이드 (13개 컴포넌트) |
| `docs/WORK_LOG.md` | 작업 로그 |

### CLAUDE.md 업데이트
- docs 디렉토리 참조 추가
- UI 컴포넌트 사용법 추가

---

## 최종 빌드 상태

```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ 39 pages generated
✓ 0 ESLint errors, 0 warnings
```

### 페이지별 번들 크기
```
/                 7.57 kB  (총 191 kB)
/admin           10.2 kB   (총 157 kB)
/ads              7.21 kB  (총 237 kB)
/chatbot          5.27 kB  (총 102 kB)
/content          9.77 kB  (총 225 kB)
/lead-form        6.41 kB  (총 113 kB)
/leads            6.55 kB  (총 149 kB)
/login            4.46 kB  (총 111 kB)
/monitor          6.59 kB  (총 113 kB)
/patients         6.12 kB  (총 154 kB)
/press            5.58 kB  (총 112 kB)
/utm              6.7 kB   (총 113 kB)

First Load JS shared: 87.6 kB
```
