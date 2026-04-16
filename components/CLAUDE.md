# UI 컴포넌트 작성 규칙

## 임포트 패턴

```typescript
// shadcn/ui
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
// 공용 컴포넌트
import { PageHeader, ChannelBadge, StatusBadge, EmptyState, SortSelect } from '@/components/common'
// 차트 (코드 스플리팅 적용)
import { AreaChart, BarChart, PieChart } from '@/components/charts'
// 토스트
import { toast } from 'sonner'
```

- 차트는 반드시 `@/components/charts`에서 import (Recharts 직접 import 금지)
- 상세 사용법: [docs/COMPONENTS.md](../docs/COMPONENTS.md)

## 커스텀 Variants

- `<Card variant="glass" />` — 글래스모피즘
- `<Badge variant="meta|google|tiktok|naver|kakao" />` — 채널별 색상
- `<Badge variant="success|warning|info" />` — 상태별 색상

## 레이아웃 밸런스 규칙 (필수)

### 같은 행 카드 높이 통일
- 차트 포함 카드: `ResponsiveContainer height`를 양쪽 동일값으로 설정
- 데이터 건수 다를 경우: `Math.max(좌측.length, 우측.length)` 기준 높이 계산
- `items-stretch`로 억지 정렬 금지 (하단 빈 여백 발생)
- `StatsCard`는 `h-full` 클래스로 높이 통일

### 범례/리스트 제한
- 차트 범례, 항목 목록: **최대 5~6개**
- 초과 시 "기타"로 합산 또는 "더보기"로 접기
- 범례가 차트보다 길어지면 안 됨

### 차트 높이 가이드
| 타입 | 높이 |
|------|------|
| 수평 바차트 | `items * 44px + 20px` |
| 영역/라인 차트 | 모바일 180px, 데스크탑 240px |
| 파이/도넛 차트 | 160px (고정) |
| 카드 내 차트 | 160px ~ 360px (동적) |

### 간격 패턴
```
섹션 간: mb-6 md:mb-8
KPI 그리드 gap: gap-2 md:gap-3
차트 그리드 gap: gap-3
카드 내부: p-4 md:p-5 (기본), p-5 md:p-6 (강조)
```

## ClinicContext (병원 선택)

```typescript
import { useClinic } from '@/components/ClinicContext'
const { selectedClinicId, clinics, setSelectedClinicId } = useClinic()
```
- `ClinicProvider`가 대시보드 레이아웃을 감싸고 있음
- `localStorage` 키 `samantha_selected_clinic`에 선택된 병원 ID 저장
- agency_staff에게 배정 병원이 1개면 자동 선택
- 활성화 토글: `Switch` 컴포넌트 사용 (Badge/아이콘 버튼 대신 통일)

## 페이지 역할 가드

```typescript
// superadmin 전용
useEffect(() => {
  if (user && user.role !== 'superadmin') router.replace('/')
}, [user, router])
if (user?.role !== 'superadmin') return null

// clinic_admin 이상
useEffect(() => {
  if (user?.role === 'clinic_staff') router.replace('/patients')
}, [user, router])
```
