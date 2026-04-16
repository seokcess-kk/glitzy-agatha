<!--
팀 공유 학습 시스템
이 파일은 Git으로 관리됩니다. 규칙 추가/수정 시 PR을 통해 팀원 리뷰를 받아주세요.
누군가 발견한 AI의 실수 패턴은 팀 전체가 공유하여 같은 실수를 반복하지 않도록 합니다.
-->
<!--
이 파일은 점진적으로 개선됩니다.
클로드가 실수하거나 의도와 다른 결과를 낼 때마다,
해당 케이스를 방지하는 규칙을 한 줄씩 추가해 주세요.
예: "API 응답 타입을 변경할 때 프론트엔드 타입도 반드시 함께 수정할 것"
-->

# Samantha — Medical Marketing Intelligence

병원 마케팅 인텔리전스 멀티테넌트 SaaS 대시보드. 슈퍼어드민이 여러 병원 고객사를 통합 관리.

**기술 스택**: Next.js 14 (App Router) · NextAuth.js (JWT) · Supabase (PostgreSQL) · Tailwind + shadcn/ui · Recharts · Sonner · Upstash QStash
**컬러**: Blue 기반 (`brand-500: #3b82f6`) — 다크모드 기본 · 브랜드 가이드: [docs/BRAND.md](docs/BRAND.md)

## 빌드 & 실행

```bash
npm install          # 의존성 설치
npm run dev          # 개발 서버 (:3000)
npm run build        # 프로덕션 빌드 (타입 체크 포함)
npm run lint         # ESLint
npm run test:e2e     # Playwright E2E 테스트
npm run test         # Jest 단위 테스트
npm run analyze      # 번들 크기 분석
```

## 디렉토리 구조

| 디렉토리 | 용도 | 하위 규칙 |
|---------|------|----------|
| `app/(dashboard)/` | 인증된 대시보드 페이지 (17개: admin, ads, bookings, campaigns, chatbot, content, erp-documents, lead-form, leads, medichecker, monitor, monitoring, patients, press, staff, utm) | |
| `app/api/` | REST API 라우트 | `app/api/CLAUDE.md` |
| `app/login/`, `app/lp/`, `app/privacy/`, `app/terms/` | 공개 페이지 | |
| `components/` | UI 컴포넌트 (ads, attribution, charts, common, dashboard, erp-documents, medichecker, ui, admin) | `components/CLAUDE.md` |
| `lib/` | 핵심 유틸리티 (auth, security, logger, date 등) | `lib/CLAUDE.md` |
| `lib/services/` | 외부 API 동기화 (metaAds, tiktokAds, googleAds, pressSync, erpClient, metaCapi) | |
| `lib/medichecker/` | 의료광고 검증 7단계 AI 파이프라인 (RAG, 온톨로지) | |
| `supabase/migrations/` | DB 마이그레이션 (`YYYYMMDD_설명.sql`) | |
| `e2e/` | Playwright E2E (fixtures, pages, tests, utils) | |
| `hooks/` | React 커스텀 훅 | |
| `types/` | 전역 타입 (next-auth.d.ts, recharts.d.ts) | |

## 도메인 용어

| 용어 | 정의 | 혼동 주의 |
|------|------|-----------|
| `Clinic` | 병원 고객사 (테넌트 단위). `clinics` 테이블 | `User`(시스템 사용자)와 구분 |
| `User` | 시스템 로그인 계정. 역할별 4종 | `Customer`와 구분 — User만 로그인 가능 |
| `Customer` | 환자/고객. `phone_number`로 식별 | 시스템 로그인 불가. CDP에서 관리 |
| `Lead` | 리드/문의. UTM + 랜딩페이지 추적 | `Customer`와 1:N. 유입 시점 데이터 |
| `Booking` | 예약. `created_by`/`updated_by` 추적 | `Consultation`(상담 기록)과 구분 |
| `Payment` | 결제. `created_by` 추적 | Booking/Consultation과 별도 테이블 |
| `Campaign` | 광고 캠페인 (Meta/Google/Naver/TikTok) | `AdSet`/`AdGroup`은 하위 타겟팅 그룹 |
| `LandingPage` | 리드 수집 랜딩페이지. 8자리 랜덤 ID | |
| `MediChecker` | 의료광고법 AI 위반 검증 도구 | 7단계: 키워드→분류→RAG→온톨로지→판단→검증 |
| `superadmin` | 전체 병원 접근. `?clinic_id=X`로 조회 | |
| `agency_staff` | 다중 병원 배정. 메뉴 권한 제한 | 배정된 병원만 접근 |
| `clinic_admin` | 자기 병원 전체 데이터 + 담당자 관리 | |
| `clinic_staff` | 예약/결제/고객/리드/언론보도만 | 광고/KPI 차단 |

## 코딩 규칙

### 필수 (위반 시 버그/보안 이슈)
1. **멀티테넌트 격리**: 모든 DB 쿼리에 `clinic_id` 필터. INSERT 시 `clinic_id` 포함. 예외 없음
2. **역할 검증**: API → `withSuperAdmin`/`withClinicAdmin`/`withClinicFilter` 래퍼. 페이지 → `useEffect` 역할 가드
3. **보안**: 사용자 입력 → `sanitizeString()`. ID → `parseId()`. 상태값 → 화이트리스트. URL → `sanitizeUrl()`
4. **활동 추적**: bookings/payments/consultations/leads 변경 시 `created_by`/`updated_by` + `logActivity()`
5. **삭제 보관**: `archiveBeforeDelete()` → `deleted_records`에 스냅샷
6. **인증 타입**: `types/next-auth.d.ts` 수정 시 `password_version` 필드 유지
7. **KST 타임존**: 날짜는 항상 KST 기준. `getKstDateString()` 사용 (상세: `lib/CLAUDE.md`)

### 네이밍 컨벤션
- 파일명: `kebab-case` · 컴포넌트: `PascalCase` · 함수/변수: `camelCase`
- DB 테이블/컬럼: `snake_case` · API 라우트 폴더: `kebab-case` · 환경변수: `UPPER_SNAKE_CASE`

### 파일/폴더 구조
- 대시보드 페이지: `app/(dashboard)/페이지명/page.tsx` + `layout.tsx` (metadata.title)
- API: `app/api/리소스명/route.ts` (CRUD), `[id]/route.ts` (개별)
- 공용 컴포넌트: `components/common/` → `index.ts`에 re-export
- 페이지 전용: `components/페이지명/` · 유틸: `lib/모듈명.ts` (200줄 초과 시 분리)

### 선호 패턴
- 토스트: `toast.success()`/`toast.error()` (sonner) · 로깅: `createLogger('Name')`
- 외부 API: `fetchJSON<T>(url, opts)` · 날짜: `lib/date.ts` · 채널: `normalizeChannel()` + `getChannelColor()`

### 금지 패턴
- `console.log` → `createLogger` · `any` 남용 → 주석 사유 · `NextResponse.json()` → `apiSuccess`/`apiError`
- `items-stretch` (빈 여백) · URL에 `sanitizeString()` (`&` 제거) → `sanitizeUrl()`
- **타임존**: `toISOString().split('T')[0]` · `toISOString().slice(0,7)` · `new Date(str+'T00:00:00')` 타임존 누락 · `toLocaleDateString()` timeZone 생략 (상세: `lib/CLAUDE.md`)

## 검증 규칙 (Self-Verification)

코드 변경 후 반드시 아래 순서로 검증. **에러 발생 시 직접 수정 후 재검증. 사용자에게 에러만 보고하지 말 것.**

### 항상 실행
1. **전체 맥락 코드 리뷰**: 호출자/피호출자 추적, DB→API→프론트 데이터 흐름, 역할별 접근, 기존 패턴 일관성, 에러/엣지 케이스
2. **빌드**: `npm run build` — 타입 에러/import 누락. 실패 시 직접 수정 후 재빌드
3. **린트**: `npm run lint` — ESLint 경고/에러 수정
4. **영향 범위**: API 타입 변경 → 프론트 수정. DB 스키마 → `supabase/migrations/`. `lib/` → 호출처 확인

### 조건부 실행
- **DB 쿼리 변경**: `clinic_id` 필터 + `applyClinicFilter()` + `assignedClinicIds` 확인
- **UI 변경**: `npm run dev` 후 확인 — 카드 높이 균일, 범례 5~6개 이내, 모바일(375px), 다크 테마 대비
- **주요 기능**: `npm run test:e2e` — 기존 테스트 통과. 새 기능이면 테스트 추가 검토

### 반복 수정 루프
```
구현 → 코드 리뷰 → 수정 → build → 수정 → lint → 수정 → 2차 리뷰 → ... → 이슈 0건 → 문서 업데이트
```
- 빌드/린트 에러가 남은 상태로 결과 보고 금지. 3회 반복 시 접근 방식 재검토
- **코드 리뷰는 수정사항 0건까지 반복** (런타임 이슈 잡기 위해 빌드 통과 후에도 추가 리뷰)

### 문서 업데이트 (필수 — 이슈 0건 확인 후)
| 변경 유형 | 대상 문서 |
|-----------|----------|
| 페이지/기능 추가 | `docs/WORK_LOG.md`, `docs/CHANGELOG.md` |
| API 엔드포인트 | `docs/API.md` |
| 컴포넌트 | `docs/COMPONENTS.md` |
| DB 테이블/마이그레이션 | `lib/CLAUDE.md`, `docs/WORK_LOG.md` |
| 유틸리티/서비스/환경변수 | `lib/CLAUDE.md` |

**CLAUDE.md 200줄 유지 정책**: 메인 CLAUDE.md는 **구조적 변경**(새 디렉토리, 새 도메인 개념)이 있을 때만 수정. 기능 추가/버그 수정의 이력은 `docs/CHANGELOG.md`에만 기록. 변경 이력은 **최근 5건 고정** — 새 항목 추가 시 가장 오래된 항목 삭제.

## 환경 분리

| 브랜치 | 용도 | Vercel |
|--------|------|--------|
| `main` | 프로덕션 | Production |
| `develop` | 스테이징 | Preview |
| `feature/*` | 기능 개발 | Preview (PR) |

`instrumentation.ts` → `validateEnv()` 호출. 프로덕션 필수 환경변수 누락 시 서버 시작 실패.

## Cron Jobs

| 경로 | 스케줄 | 용도 |
|------|--------|------|
| `/api/cron/sync-ads` | 매일 03:00 | 광고 데이터 동기화 |
| `/api/cron/sync-press` | 매일 00:00 | 언론보도 동기화 |
| `/api/cron/weekly-report` | 매주 월 09:00 KST | 주간 성과 리포트 SMS |

## 참조 문서

| 문서 | 내용 |
|------|------|
| `app/api/CLAUDE.md` | API 라우트 작성 규칙 (미들웨어, 멀티테넌트, 응답, 입력 검증) |
| `components/CLAUDE.md` | UI 컴포넌트 규칙 (임포트, 레이아웃 밸런스, ClinicContext, 역할 가드) |
| `lib/CLAUDE.md` | 인증 흐름, 환경변수, DB 스키마, KST 타임존, 유틸리티 모듈 |
| [docs/SPEC.md](docs/SPEC.md) | 프로젝트 요구사항 명세 |
| [docs/API.md](docs/API.md) | REST API 엔드포인트 상세 |
| [docs/COMPONENTS.md](docs/COMPONENTS.md) | UI 컴포넌트 사용 가이드 |
| [docs/BRAND.md](docs/BRAND.md) | Samantha 브랜드 가이드 |
| [docs/WORK_LOG.md](docs/WORK_LOG.md) | 작업 로그 인덱스 |
| [docs/INTEGRATION.md](docs/INTEGRATION.md) | glitzy-web ERP 연동 가이드 |
| [docs/MEDICHECKER.md](docs/MEDICHECKER.md) | MediChecker 의료광고 검증 모듈 |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | 전체 변경 이력 |

## 변경 이력 (최근)

전체 이력: [docs/CHANGELOG.md](docs/CHANGELOG.md)

| 날짜 | 내용 |
|------|------|
| 2026-04-07 | 광고 플랫폼 2계층 구조: `lib/platform.ts` 중앙 상수, campaign_type 컬럼, platform 값 통일, Naver/Kakao/Dable 신규 |
| 2026-04-07 | 시술별 매출 비중 KPI 불일치 수정, capi_events FK CASCADE |
| 2026-04-01 | 캘린더 UX 개선: 일간 10분 슬롯, 현재 시간 구분선, 전체 예약 표시, 취소/노쇼 취소선 시각 구분 |
| 2026-04-01 | 예약/결제 관리 캘린더 드래그앤드롭 (`@dnd-kit/core`), DateRangePicker 도트 표시, 미래 날짜 허용 |
| 2026-03-30 | CLAUDE.md 재설계: 200줄 이내 압축, 변경 이력 분리, 디렉토리 구조 압축 |
