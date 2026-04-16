# Samantha 컴포넌트 가이드

## 개요

Samantha 대시보드는 **shadcn/ui** 기반의 커스텀 디자인 시스템을 사용합니다.
모든 컴포넌트는 다크 테마(글래스모피즘)가 기본 적용되어 있습니다.

---

## 디렉토리 구조

```
components/
├── ui/                    # shadcn/ui 컴포넌트
│   ├── button.tsx
│   ├── card.tsx
│   ├── badge.tsx
│   ├── input.tsx
│   ├── select.tsx
│   ├── label.tsx
│   ├── skeleton.tsx
│   ├── table.tsx
│   ├── tabs.tsx
│   ├── dialog.tsx
│   ├── sheet.tsx
│   ├── dropdown-menu.tsx
│   └── sonner.tsx
│
├── common/                # 프로젝트 공용 컴포넌트
│   ├── page-header.tsx
│   ├── stats-card.tsx
│   ├── channel-badge.tsx
│   ├── status-badge.tsx
│   ├── sort-select.tsx     # 정렬 드롭다운 (공용)
│   ├── confirm-dialog.tsx
│   ├── customer-journey.tsx
│   └── empty-state.tsx
│
├── charts/               # Recharts 코드 스플리팅 래퍼
│   └── index.tsx          # AreaChart, BarChart, PieChart, LineChart, ComposedChart 등
│
├── dashboard/            # 대시보드 섹션 컴포넌트
│   ├── kpi-section.tsx    # KPI 카드 5개 (광고비/리드+오늘/CPL/매출/ROAS)
│   ├── spend-lead-trend.tsx # 광고비+리드 듀얼 축 차트
│   ├── treatment-pie.tsx  # 시술별 매출 비중 파이 차트
│   ├── funnel-section.tsx # 전환 퍼널 3단계 (리드→예약→결제)
│   ├── recent-leads.tsx   # 최근 리드 8건 피드 (실시간)
│   ├── channel-table.tsx  # 채널 성과 테이블 (정렬, ROAS 바)
│   └── date-range-picker.tsx # 날짜 범위 선택기
│
├── ads/                 # 광고 성과 페이지 컴포넌트
│   ├── ads-kpi-cards.tsx           # 8종 KPI 카드 (전기 대비 변화율)
│   ├── efficiency-trend-chart.tsx  # CPL·CPC·CTR 이중축 추이 차트
│   ├── platform-comparison-table.tsx # 매체별 성과 비교 테이블
│   ├── ads-funnel.tsx              # 노출→결제 5단계 퍼널
│   ├── campaign-ranking-table.tsx  # 캠페인 정렬·검색·CPC 상태 테이블
│   ├── day-of-week-analysis.tsx    # 요일별 리드 바 차트
│   ├── landing-page-performance.tsx # LP별 전환율 테이블 (레거시)
│   ├── landing-page-analysis.tsx   # LP 분석 종합 (채널 분해 + 추이 차트)
│   ├── landing-page-channel-breakdown.tsx # LP별 채널 분해 차트
│   ├── landing-page-trend-chart.tsx      # LP별 일별 추이 차트
│   ├── ads-overview-tab.tsx        # 성과 개요 탭 레이아웃
│   ├── ads-campaign-tab.tsx        # 캠페인 분석 탭 레이아웃
│   └── CreativePerformance.tsx     # 소재별 성과 (광고 지표 10컬럼, 캠페인 필터, 10건 페이지네이션)
│
├── medichecker/         # 원고 검수 (MediChecker)
│   ├── text-input-card.tsx       # 텍스트 입력 + 하이라이트 뷰
│   ├── ad-type-selector.tsx      # 매체 유형 선택 (blog/instagram/youtube/other)
│   ├── verify-progress.tsx       # 7단계 검증 진행 표시
│   ├── result-kpi-cards.tsx      # 결과 KPI 4카드 (위험도/위반/시간/참조)
│   ├── violation-card.tsx        # 위반 카드 (접기/펼치기, 수정 제안, 법령 근거)
│   ├── violation-highlight.tsx   # 텍스트 하이라이트 (신뢰도별 색상)
│   └── history-table.tsx         # 검수 이력 테이블 (페이지네이션)
│
├── erp-documents/       # ERP 문서 (견적서/계산서)
│   ├── quote-list.tsx          # 견적서 목록 테이블 + Sheet 상세 + 승인/반려 (sent 상태)
│   └── invoice-list.tsx        # 계산서 목록 테이블 + Sheet 상세
│
├── admin/               # 관리자 전용 컴포넌트
│   └── ClinicApiConfigDialog.tsx  # 매체별 API 키 관리 다이얼로그
│
├── Sidebar.tsx            # 사이드바 네비게이션
├── ClinicContext.tsx      # 병원 선택 Context
└── Providers.tsx          # 전역 Provider
```

---

## UI 컴포넌트

### Button

```tsx
import { Button } from '@/components/ui/button'

// 기본
<Button>기본 버튼</Button>

// Variants
<Button variant="default">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="destructive">Destructive</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="glass">Glass (커스텀)</Button>

// Sizes
<Button size="default">Default</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Icon /></Button>

// 링크로 사용
<Button asChild>
  <a href="/path">링크</a>
</Button>
```

### Card

```tsx
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

// 기본 (다크테마)
<Card>
  <CardHeader>
    <CardTitle>제목</CardTitle>
  </CardHeader>
  <CardContent>내용</CardContent>
</Card>

// Glass variant (글래스모피즘)
<Card variant="glass" className="p-4">
  내용
</Card>
```

### Badge

```tsx
import { Badge } from '@/components/ui/badge'

// 기본 variants
<Badge variant="default">Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="destructive">Error</Badge>

// 채널별 variants
<Badge variant="meta">Meta</Badge>
<Badge variant="google">Google</Badge>
<Badge variant="tiktok">TikTok</Badge>
<Badge variant="naver">Naver</Badge>
<Badge variant="kakao">Kakao</Badge>

// 상태별 variants
<Badge variant="success">성공</Badge>
<Badge variant="warning">주의</Badge>
<Badge variant="info">정보</Badge>
```

### Input

```tsx
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// 기본 (다크테마 자동 적용)
<div className="space-y-2">
  <Label>레이블</Label>
  <Input placeholder="입력하세요" />
</div>

// 타입별
<Input type="text" />
<Input type="password" />
<Input type="email" />
<Input type="number" />
<Input type="date" />
<Input type="datetime-local" />
```

### Select

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

<Select value={value} onValueChange={setValue}>
  <SelectTrigger>
    <SelectValue placeholder="선택하세요" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">옵션 1</SelectItem>
    <SelectItem value="option2">옵션 2</SelectItem>
  </SelectContent>
</Select>
```

### Table

```tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>컬럼 1</TableHead>
      <TableHead>컬럼 2</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>데이터 1</TableCell>
      <TableCell>데이터 2</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

### Dialog

```tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>제목</DialogTitle>
    </DialogHeader>
    <div>내용</div>
    <DialogFooter>
      <Button variant="ghost" onClick={() => setOpen(false)}>취소</Button>
      <Button onClick={handleSave}>저장</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Toast (Sonner)

```tsx
import { toast } from 'sonner'

// 성공
toast.success('저장되었습니다.')

// 에러
toast.error('오류가 발생했습니다.')

// 정보
toast.info('안내 메시지')

// 로딩
toast.loading('처리 중...')
```

### Skeleton

```tsx
import { Skeleton } from '@/components/ui/skeleton'

// 로딩 상태
{loading ? (
  <Skeleton className="h-10 w-full" />
) : (
  <div>{data}</div>
)}
```

---

## 공용 컴포넌트

### PageHeader

```tsx
import { PageHeader } from '@/components/common'

<PageHeader
  title="페이지 제목"
  description="페이지 설명 (선택)"
  actions={
    <Button>액션 버튼</Button>
  }
/>
```

### ChannelBadge

```tsx
import { ChannelBadge } from '@/components/common'

// 채널명에 따라 자동으로 색상 결정
<ChannelBadge channel="Meta" />
<ChannelBadge channel="Google" />
<ChannelBadge channel="네이버" />
```

### StatusBadge

```tsx
import { StatusBadge } from '@/components/common'

<StatusBadge status="confirmed" />
<StatusBadge status="cancelled" />
```

### StatsCard

```tsx
import { StatsCard } from '@/components/common'
import { TrendingUp } from 'lucide-react'

// 기본
<StatsCard label="총 문의" value="150건" />

// 트렌드 표시 (전기 대비 %)
<StatsCard
  label="총 매출"
  value="₩5,000만"
  trend={{ value: 15.2, isPositive: true }}
/>

// 클릭 네비게이션
<StatsCard
  label="광고비"
  value="₩500만"
  onClick={() => router.push('/ads')}
/>

// 큰 사이즈 + 아이콘 + 서브타이틀 (오늘 요약용)
<StatsCard
  label="오늘 문의"
  value="5건"
  size="lg"
  icon={TrendingUp}
  subtitle="전일 대비 +2건"
  subtitleColor="positive"   // 'default' | 'positive' | 'negative'
/>
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | string | required | 카드 라벨 |
| `value` | string \| number | required | 표시 값 |
| `loading` | boolean | false | 스켈레톤 표시 |
| `icon` | LucideIcon | - | 라벨 옆 아이콘 |
| `trend` | `{ value: number, isPositive: boolean }` | - | 증감 화살표 + 퍼센트 |
| `onClick` | `() => void` | - | 클릭 시 커서/호버 효과 |
| `subtitle` | string | - | value 아래 보조 텍스트 |
| `subtitleColor` | `'default' \| 'positive' \| 'negative'` | `'default'` | 서브타이틀 색상 |
| `size` | `'default' \| 'lg'` | `'default'` | lg: 큰 폰트 + 패딩 |

**동적 폰트 크기:** 값 문자열 길이에 따라 폰트 크기가 자동 축소되어, 좁은 카드(8열 그리드 등)에서도 값이 잘리지 않고 전체 표시됩니다.

| 길이 | 기본 사이즈 | lg 사이즈 |
|------|------------|-----------|
| ≤6자 | `text-xl` / `md:text-2xl` | `text-2xl` / `md:text-3xl` |
| 7–9자 | `text-lg` / `md:text-xl` | `text-xl` / `md:text-2xl` |
| 10–12자 | `text-base` / `md:text-lg` | `text-lg` / `md:text-xl` |
| 13자+ | `text-sm` / `md:text-base` | `text-base` / `md:text-lg` |

### EmptyState

```tsx
import { EmptyState } from '@/components/common'
import { FileX } from 'lucide-react'

<EmptyState
  icon={FileX}
  title="데이터가 없습니다"
  description="새 데이터를 추가하세요"
/>
```

### SortSelect

정렬 옵션 드롭다운. 여러 페이지에서 공용으로 사용합니다.

```tsx
import { SortSelect } from '@/components/common'

<SortSelect
  value={sortBy}
  onValueChange={setSortBy}
  options={[
    { value: 'newest', label: '최신순' },
    { value: 'oldest', label: '오래된순' },
    { value: 'name', label: '이름순' },
    { value: 'payment', label: '결제액순' },
  ]}
/>
```

| Prop | 타입 | 설명 |
|------|------|------|
| `value` | `string` | 현재 선택된 정렬 값 |
| `onValueChange` | `(value: string) => void` | 정렬 변경 콜백 |
| `options` | `SortOption[]` | `{ value, label }` 배열 |
| `className` | `string?` | 추가 CSS 클래스 |

### DateRangePicker

시작일/종료일을 명시적으로 표시하는 날짜 범위 선택 컴포넌트. 프리셋(오늘, 7일, 14일, 이번 달, 30일, 90일) + 캘린더(2개월) 제공.

```tsx
import { DateRangePicker } from '@/components/dashboard/date-range-picker'
import { DateRange } from 'react-day-picker'

const [dateRange, setDateRange] = useState<DateRange>({
  from: startOfMonth(startOfDay(new Date())),
  to: startOfDay(new Date()),
})

<DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
```

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `dateRange` | `DateRange` | `{ from?: Date, to?: Date }` |
| `onDateRangeChange` | `(range: DateRange) => void` | 범위 변경 콜백 |
| `allowFuture?` | `boolean` | 미래 날짜 선택 허용 (기본 `false`) |
| `bookedDates?` | `Date[]` | 예약 있는 날짜에 도트 표시 |

**트리거 표시:** `📅 2026.03.01 ~ 2026.03.26` (시작일/종료일 명시)
**팝오버 상단:** 시작일/종료일 라벨 + `yyyy.MM.dd (eee)` 포맷으로 선택 상태 표시
**사용 페이지:** 대시보드, 광고 성과, 언론보도, 캠페인 리드, 환자/예약 (5곳)

### 예약 캘린더 DnD 컴포넌트

**DraggableBooking** (`components/patients/draggable-booking.tsx`): `@dnd-kit/core` 기반 드래그 가능한 예약 카드. `month`/`week`/`day` variant 지원. cancelled/noshow 상태는 드래그 비활성화.

**DroppableCell** (`components/patients/droppable-cell.tsx`): 드롭 가능한 날짜/시간 셀. `dateKey`와 선택적 `hour` 데이터 전달. 드래그 hover 시 하이라이트 표시.

---

## 대시보드 섹션 컴포넌트

대시보드 page.tsx를 섹션별로 분리한 컴포넌트들입니다.
각 컴포넌트는 `data`와 `loading` props로 독립 로딩이 가능합니다.

### KpiSection

5개 KPI를 비즈니스 흐름순(광고비 → 리드+오늘 → CPL → 매출 → ROAS)으로 표시합니다. 리드 카드에 "오늘 +N" subtitle 포함.

```tsx
import { KpiSection } from '@/components/dashboard/kpi-section'

<KpiSection
  data={kpiData}        // KPI API 응답 객체 (today.leads 포함)
  loading={false}
  onNavigate={(path) => router.push(path)}  // 카드 클릭 시 이동
/>
```

### SpendLeadTrend

광고비(Area) + 리드 수(Line) 듀얼 축 차트입니다.

```tsx
import { SpendLeadTrend } from '@/components/dashboard/spend-lead-trend'

<SpendLeadTrend
  data={[
    { date: '3/1', spend: 500000, leads: 12 },
    { date: '3/8', spend: 600000, leads: 15 },
  ]}
  loading={false}
/>
```

### RecentLeads

최근 리드 8건을 실시간 피드로 표시합니다. DatePicker 영향 안 받음 (항상 최신).

```tsx
import { RecentLeads } from '@/components/dashboard/recent-leads'

<RecentLeads
  data={recentLeads}    // RecentLead[] (name, utmSource, createdAt, phoneNumber)
  loading={false}
/>
```

### ChannelTable

채널별 성과를 정렬 가능한 테이블로 표시합니다. ROAS 인라인 바 포함.

```tsx
import { ChannelTable } from '@/components/dashboard/channel-table'

<ChannelTable
  data={channelData}    // channel API 응답 (clicks, impressions, ctr 포함)
  loading={false}
/>
```

---

## 광고 성과 컴포넌트

`/ads` 페이지는 3탭 구조로 구성되어 있으며, 각 탭 컴포넌트가 독립적으로 데이터를 fetch합니다.

### 탭 구조

```
Tab 1: 성과 개요 (AdsOverviewTab)
  ├─ AdsKpiCards        — 8종 KPI (trend 포함)
  ├─ EfficiencyTrendChart — CPL·CPC·CTR 이중축 차트
  ├─ PlatformComparisonTable — 매체별 성과 테이블
  ├─ AdsFunnel          — 노출→결제 5단계 퍼널
  └─ grid 2열
     ├─ DayOfWeekAnalysis — 요일별 바 차트
     └─ LandingPagePerformance — LP별 전환율

Tab 2: 캠페인 분석 (AdsCampaignTab)
  ├─ 매체 필터 버튼
  ├─ CampaignRankingTable — 정렬·검색·CPC 상태·CPL (ad_stats 경유)
  └─ CreativePerformance — 소재별 성과 (지출/노출/클릭/CPC/CTR/리드/CPL, 캠페인 필터, 10건 페이지네이션)

Tab 3: 매출 귀속 (AttributionView) — 변경 없음
```

### AdsKpiCards

```tsx
import AdsKpiCards from '@/components/ads/ads-kpi-cards'

<AdsKpiCards days="30" />
```

8개 카드: 총 광고비, 총 리드, CPL, ROAS, CPC, CTR, 리드→결제 전환율, CAC.
CPL/CPC/CAC는 역전 trend (감소=긍정).

### EfficiencyTrendChart

```tsx
import EfficiencyTrendChart from '@/components/ads/efficiency-trend-chart'

<EfficiencyTrendChart days="30" />
```

ComposedChart 이중 Y축: 좌축(₩) CPL Area + CPC Line, 우축(%) CTR Line.

### PlatformComparisonTable

```tsx
import PlatformComparisonTable from '@/components/ads/platform-comparison-table'

<PlatformComparisonTable days="30" />
```

매체별 8개 지표 테이블. 최저 CPL 하이라이트, ROAS 색상 분기, 하단 인사이트 텍스트.

### AdsFunnel

```tsx
import AdsFunnel from '@/components/ads/ads-funnel'

<AdsFunnel days="30" />
```

노출→클릭→리드→예약→결제 5단계 수평 바 퍼널. 최대 이탈 구간 자동 감지.

### CampaignRankingTable

```tsx
import CampaignRankingTable from '@/components/ads/campaign-ranking-table'

<CampaignRankingTable days="30" platformFilter="Meta" />
```

캠페인별 지출/클릭/노출/CPC/CTR. 헤더 클릭 정렬, CPC 상태 표시(🟢🟡🔴), 검색, 10건 단위 펼치기.

### DayOfWeekAnalysis

```tsx
import DayOfWeekAnalysis from '@/components/ads/day-of-week-analysis'

<DayOfWeekAnalysis days="30" />
```

7칼럼 BarChart. 최다 리드 요일 강조 색상, 바 위 CPL 라벨.

### LandingPagePerformance

```tsx
import LandingPagePerformance from '@/components/ads/landing-page-performance'

<LandingPagePerformance days="30" />
```

LP별 리드 성과. `mode` prop으로 delivery(광고 지표만)/full(전환 포함) 전환.
LP 1개일 때 퍼포먼스 카드로 자동 전환.

```tsx
import LandingPageAnalysis from '@/components/ads/landing-page-analysis'

<LandingPageAnalysis startDate="2026-03-01" endDate="2026-03-30" mode="delivery" />
```

---

## 매출 귀속 컴포넌트

`/ads` 매출 귀속 탭의 전환·매출 분석 UI입니다.

### ConversionFunnel

리드→예약→결제 3단계 전환 퍼널. `/api/dashboard/funnel` API 사용.

### ChannelRevenueChart

채널별 매출 비중 도넛 차트. `byChannel` prop으로 데이터 전달 (AttributionView에서 fetch한 데이터 재사용).

### RoasTrendChart

채널별 ROAS 일별 추이 라인차트. `/api/attribution/roas-trend` API 사용.

### LpConversionTable

랜딩페이지별 전환 성과 테이블 (예약고객/예약전환율/결제고객/전환율/매출). `/api/ads/landing-page-analysis` API 사용.

---

## 원고 검수 컴포넌트

`/medichecker` 페이지의 AI 기반 의료광고법 위반 검증 UI입니다. SSE 스트리밍으로 7단계 진행 상황을 실시간 표시합니다.

### TextInputCard

텍스트 입력 + 하이라이트 모드 전환 컴포넌트.

```tsx
import { TextInputCard } from '@/components/medichecker/text-input-card'

<TextInputCard
  text={text}
  onTextChange={setText}
  violations={result?.violations}
  highlightMode={highlightMode}
  onToggleHighlight={() => setHighlightMode(!highlightMode)}
  selectedViolationIndex={selectedViolationIndex}
  onSelectViolation={setSelectedViolationIndex}
  disabled={isLoading}
/>
```

| Prop | 타입 | 설명 |
|------|------|------|
| `text` | `string` | 입력 텍스트 |
| `onTextChange` | `(text: string) => void` | 텍스트 변경 콜백 |
| `violations` | `Violation[]` | 검증 결과 위반 목록 |
| `highlightMode` | `boolean` | 하이라이트 모드 활성화 |
| `onToggleHighlight` | `() => void` | 모드 전환 콜백 |
| `selectedViolationIndex` | `number \| null` | 선택된 위반 인덱스 |
| `onSelectViolation` | `(index: number) => void` | 위반 선택 콜백 |

### ViolationCard

위반 상세 카드 (접기/펼치기, 수정 제안, 법령 근거).

```tsx
import { ViolationCard } from '@/components/medichecker/violation-card'

<ViolationCard
  violation={violation}
  index={idx}
  isSelected={selectedViolationIndex === idx}
  onSelect={setSelectedViolationIndex}
/>
```

**신뢰도별 색상:**
- 90%+ (높음): `rose-500` 계열
- 60-89% (중간): `amber-500` 계열
- 60% 미만 (낮음): `muted` 계열

### VerifyProgress

7단계 검증 진행 표시 (접기/펼치기 가능).

```tsx
import { VerifyProgress } from '@/components/medichecker/verify-progress'

<VerifyProgress
  progress={progress}          // Map<VerifyStage, VerifyProgress>
  currentStage={currentStage}  // VerifyStage | null
  isComplete={!!result}
/>
```

### useVerification Hook

SSE 스트리밍 검증 훅.

```tsx
import { useVerification } from '@/hooks/use-verification'

const {
  result,          // VerifyResult | null
  progress,        // Map<VerifyStage, VerifyProgress>
  isLoading,       // boolean
  error,           // string | null
  currentStage,    // VerifyStage | null
  verify,          // (text, adType) => Promise<void>
  abort,           // () => void
  reset,           // () => void
} = useVerification({ clinicId: selectedClinicId })
```

---

## 차트 래퍼

`components/charts/index.tsx`에서 Recharts를 코드 스플리팅으로 제공합니다.

```tsx
import {
  AreaChart, BarChart, PieChart, LineChart, ComposedChart,
  ResponsiveContainer,
  Area, Bar, Line, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from '@/components/charts'
```

- 컨테이너 컴포넌트(`AreaChart`, `ComposedChart` 등)는 `dynamic()` import (SSR 비활성)
- 자식 컴포넌트(`Area`, `XAxis` 등)는 직접 re-export (번들 분리 불필요)
- `ComposedChart`: Area + Line 등 서로 다른 차트를 한 축에 결합할 때 사용

### 채널 색상 유틸

```tsx
import { getChannelColor, CHANNEL_COLORS } from '@/lib/channel-colors'

getChannelColor('Meta')    // → '#3b82f6'
getChannelColor('Google')  // → '#ef4444'
getChannelColor('unknown') // → '#64748b' (기본 slate)
```

### 차트 컬러 상수 (`lib/chart-colors.ts`)

Recharts 컴포넌트의 하드코딩된 hex 값을 중앙 관리합니다.

```tsx
import { CHART_PALETTE, CHART_SEMANTIC, PIE_SHADES, BAR_COLORS, FUNNEL_COLORS } from '@/lib/chart-colors'

CHART_PALETTE       // 범용 5색 팔레트 (blue, amber, emerald, red, violet)
CHART_SEMANTIC.cpl  // '#3b82f6' — CPL 차트
CHART_SEMANTIC.cpc  // '#f59e0b' — CPC 차트
CHART_SEMANTIC.ctr  // '#10b981' — CTR 차트
PIE_SHADES          // 파이/도넛 6색 그라데이션
BAR_COLORS.max      // '#3b82f6' — 최대값 바
BAR_COLORS.default  // '#93c5fd' — 기본 바
FUNNEL_COLORS       // 퍼널 5단계 컬러
```

### Recharts 커스텀 툴팁 타입 (`types/recharts.d.ts`)

```tsx
import { ChartTooltipProps, ChartLabelProps } from '@/types/recharts'

function MyTooltip({ active, payload, label }: ChartTooltipProps) { ... }
function MyLabel(props: ChartLabelProps) { ... }
```

---

## 스타일 가이드

### CSS 변수 (globals.css)

```css
:root {
  --background: 240 20% 5%;       /* 배경색 */
  --foreground: 214 32% 91%;      /* 텍스트 색상 */
  --primary: 239 84% 67%;         /* 브랜드 색상 */
  --border: 240 10% 15%;          /* 테두리 색상 */
  --radius: 0.75rem;              /* 기본 border-radius */
}
```

### 글래스모피즘 (glass-card)

```css
.glass-card {
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
}
```

### 브랜드 색상

```
brand-50:  #eef2ff
brand-100: #e0e7ff
brand-400: #818cf8
brand-500: #6366f1  (Primary)
brand-600: #4f46e5
brand-700: #4338ca
brand-900: #1e1b4b
```

---

## 사용 패턴

### 데이터 로딩

```tsx
{loading ? (
  <div className="space-y-3">
    {Array(5).fill(0).map((_, i) => (
      <Skeleton key={i} className="h-12" />
    ))}
  </div>
) : data.length > 0 ? (
  <Table>...</Table>
) : (
  <EmptyState title="데이터가 없습니다" />
)}
```

### 폼 패턴

```tsx
<Card variant="glass" className="p-6">
  <form onSubmit={handleSubmit} className="space-y-4">
    <div className="space-y-2">
      <Label>필드명</Label>
      <Input value={value} onChange={e => setValue(e.target.value)} />
    </div>
    <Button type="submit" className="w-full bg-brand-600">
      제출
    </Button>
  </form>
</Card>
```

### 필터 버튼 그룹

```tsx
<div className="flex gap-2">
  {filters.map(filter => (
    <Button
      key={filter.key}
      variant={active === filter.key ? 'default' : 'glass'}
      size="sm"
      onClick={() => setActive(filter.key)}
      className={active === filter.key ? 'bg-brand-600' : ''}
    >
      {filter.label}
    </Button>
  ))}
</div>
```
