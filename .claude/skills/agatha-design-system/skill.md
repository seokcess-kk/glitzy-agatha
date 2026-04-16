---
name: agatha-design-system
description: "Agatha UI 컴포넌트 구현 가이드. Slate+Violet 컬러, Pretendard+Geist Mono 폰트, 8px radius, 보더 Only 카드, 상태 배지 색상 등 모든 디자인 규격을 담고 있다. UI 컴포넌트를 만들거나 수정할 때, 색상/폰트/레이아웃을 결정할 때, 차트를 구현할 때 반드시 이 스킬을 사용할 것."
---

# Agatha Design System Implementation Guide

## 목적

DESIGN_SYSTEM.md에 정의된 디자인 규격을 코드로 구현할 때 참조하는 실전 가이드.

## 사용 시점

- shadcn/ui 컴포넌트를 커스터마이징할 때
- 새 페이지/컴포넌트를 만들 때
- 차트 색상을 적용할 때
- 상태 배지를 구현할 때

## 핵심 규격 (빠른 참조)

전체 디자인 규격은 `docs/DESIGN_SYSTEM.md`에 있다. 여기서는 구현 시 가장 자주 참조하는 핵심만 정리한다.

### 컬러 매핑

```typescript
// tailwind.config.ts의 brand 색상
brand: {
  50: '#F5F3FF',   // Violet-50
  100: '#EDE9FE',  // Violet-100
  500: '#8B5CF6',  // Violet-500
  600: '#7C3AED',  // Violet-600 (메인 포인트)
  700: '#6D28D9',  // Violet-700
}

// 차트 팔레트
const CHART_COLORS = [
  '#7C3AED', // Violet
  '#06B6D4', // Cyan
  '#D97706', // Amber
  '#0D9488', // Teal
  '#E11D48', // Rose
  '#64748B', // Slate
]

// 시맨틱
const SEMANTIC = {
  positive: '#059669', // Emerald - 상승, 전환
  negative: '#E11D48', // Rose - 하락, 이탈
  warning:  '#D97706', // Amber - 경고
  info:     '#0EA5E9', // Sky - 정보
}
```

### 상태 배지 구현

```typescript
const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  new:         { bg: 'bg-violet-50',  text: 'text-violet-700',  label: '신규' },
  in_progress: { bg: 'bg-amber-50',   text: 'text-amber-700',   label: '진행중' },
  converted:   { bg: 'bg-emerald-50', text: 'text-emerald-700', label: '전환' },
  hold:        { bg: 'bg-slate-100',  text: 'text-slate-600',   label: '보류' },
  lost:        { bg: 'bg-rose-50',    text: 'text-rose-700',    label: '미전환' },
  invalid:     { bg: 'bg-slate-50',   text: 'text-slate-400',   label: '무효' },
}
```

### KPI 카드 폰트

```tsx
// KPI 숫자에는 Geist Mono, 라벨에는 Pretendard
<p className="text-sm font-medium text-slate-500">리드</p>
<p className="text-2xl font-semibold text-slate-900 font-mono">150건</p>
<p className="text-sm font-mono text-emerald-600">▲ 12%</p>
```

### 테이블 정렬

```tsx
// 첫 열(이름): 왼쪽 정렬, 나머지(숫자): 오른쪽 정렬
<th className="text-left">채널</th>
<th className="text-right font-mono">광고비</th>
<th className="text-right font-mono">리드</th>
<th className="text-right font-mono">ROAS</th>
```

### 카드 스타일

```tsx
// 기본 카드: 보더 Only, 섀도우 없음
<div className="border border-slate-200 rounded-lg p-5 bg-white hover:border-violet-600 transition-colors">
  {children}
</div>
```

### 토스트

```typescript
// Sonner, 상단 중앙
import { toast } from 'sonner'
toast.success('전환 결과가 저장되었습니다')
toast.error('저장에 실패했습니다')
```

## 상세 규격 참조

구현 중 상세 규격이 필요하면 `docs/DESIGN_SYSTEM.md`를 읽는다:
- 다크모드 라이트↔다크 매핑 → DESIGN_SYSTEM.md 1장 모드 섹션
- 폼 컴포넌트 (높이, 포커스 링, 에러 상태) → DESIGN_SYSTEM.md 4장 폼 컴포넌트
- 로딩/에러 상태 패턴 → DESIGN_SYSTEM.md 4장 로딩/에러 상태
- 로그인/회원가입 페이지 레이아웃 → DESIGN_SYSTEM.md 5장
