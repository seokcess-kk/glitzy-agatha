# Agatha — Marketing Intelligence

업종 무관 범용 마케팅 인텔리전스 멀티테넌트 SaaS 대시보드. 에이전시가 여러 클라이언트를 통합 관리.

**기술 스택**: Next.js 14 (App Router) · NextAuth.js (JWT) · Supabase (PostgreSQL) · Tailwind + shadcn/ui · Recharts · Sonner · Upstash QStash
**컬러**: Slate 모노톤 + Deep Violet (`brand-600: #7C3AED`) — 라이트모드 기본
**폰트**: Pretendard(본문) + Geist Mono(KPI 숫자)

## 빌드 & 실행

```bash
npm install          # 의존성 설치
npm run dev          # 개발 서버 (:3000)
npm run build        # 프로덕션 빌드 (타입 체크 포함)
npm run lint         # ESLint
npm run test:e2e     # Playwright E2E 테스트
npm run test         # Jest 단위 테스트
```

## 디렉토리 구조

| 디렉토리 | 용도 | 하위 규칙 |
|---------|------|----------|
| `app/(dashboard)/` | 인증된 대시보드 페이지 (admin, ads, campaigns, customers, erp-documents, lead-form, monitoring, utm) | |
| `app/api/` | REST API 라우트 | `app/api/CLAUDE.md` |
| `app/login/`, `app/signup/`, `app/lp/`, `app/privacy/`, `app/terms/` | 공개 페이지 | |
| `components/` | UI 컴포넌트 (ads, admin, charts, common, customers, dashboard, erp-documents, ui) | `components/CLAUDE.md` |
| `lib/` | 핵심 유틸리티 (auth, security, logger, date 등) | `lib/CLAUDE.md` |
| `lib/services/` | 외부 API 동기화 (metaAds, tiktokAds, googleAds, adSyncManager, metaCapi, erpClient) | |
| `supabase/migrations/` | DB 마이그레이션 (`YYYYMMDD_설명.sql`) | |
| `e2e/` | Playwright E2E (fixtures, pages, tests, utils) | |
| `hooks/` | React 커스텀 훅 | |
| `types/` | 전역 타입 (next-auth.d.ts, recharts.d.ts) | |

## 도메인 용어

| 용어 | 정의 | 혼동 주의 |
|------|------|-----------|
| `Client` | 클라이언트 고객사 (테넌트 단위). `clients` 테이블 | `User`(시스템 사용자)와 구분 |
| `User` | 시스템 로그인 계정. 역할별 4종 | `Contact`와 구분 — User만 로그인 가능 |
| `Contact` | 고객/연락처. `phone_number`로 식별 | 시스템 로그인 불가. CDP에서 관리 |
| `Lead` | 리드/문의. UTM + 랜딩페이지 추적 | `Contact`와 1:N. 유입 시점 데이터 |
| `Campaign` | 광고 캠페인 (Meta/Google/TikTok/Naver/Kakao/Dable) | `AdSet`/`AdGroup`은 하위 타겟팅 그룹 |
| `LandingPage` | 리드 수집 랜딩페이지. 8자리 랜덤 ID | |
| `superadmin` | 전체 클라이언트 접근. `?client_id=X`로 조회 | |
| `agency_staff` | 다중 클라이언트 배정. 메뉴 권한 제한 | 배정된 클라이언트만 접근 |
| `client_admin` | 자기 클라이언트 전체 데이터 + 담당자 관리 | |
| `client_staff` | 리드/전환 결과 입력만 | 광고/KPI 차단 |
| `erp_client_id` | clients 테이블의 glitzy-web ERP 거래처 UUID (TEXT) | webhook/pull/일괄 동기화로 매핑 |

## 코딩 규칙

### 필수 (위반 시 버그/보안 이슈)
1. **멀티테넌트 격리**: 모든 DB 쿼리에 `client_id` 필터. INSERT 시 `client_id` 포함. 예외 없음
2. **역할 검증**: API → `withSuperAdmin`/`withClientAdmin`/`withClientFilter` 래퍼. 페이지 → `useEffect` 역할 가드
3. **보안**: 사용자 입력 → `sanitizeString()`. ID → `parseId()`. 상태값 → 화이트리스트. URL → `sanitizeUrl()`
4. **활동 추적**: bookings/payments/leads 변경 시 `created_by`/`updated_by` + `logActivity()`
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
- **DB 쿼리 변경**: `client_id` 필터 + `applyClientFilter()` + `assignedClientIds` 확인
- **UI 변경**: `npm run dev` 후 확인 — 카드 높이 균일, 범례 5~6개 이내, 모바일(375px)
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

**CLAUDE.md 200줄 유지 정책**: 메인 CLAUDE.md는 **구조적 변경**(새 디렉토리, 새 도메인 개념)이 있을 때만 수정. 기능 추가/버그 수정의 이력은 `docs/CHANGELOG.md`에만 기록.

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
| `/api/cron/sync-ads` | 매일 06:00 KST (UTC 21:00) | 광고 데이터 동기화 |
| `/api/cron/send-reports` | 매일 08:00 KST (UTC 23:00) | 성과 리포트 SMS |

## 참조 문서

| 문서 | 내용 |
|------|------|
| `app/api/CLAUDE.md` | API 라우트 작성 규칙 (미들웨어, 멀티테넌트, 응답, 입력 검증) |
| `components/CLAUDE.md` | UI 컴포넌트 규칙 (임포트, 레이아웃 밸런스, ClientContext, 역할 가드) |
| `lib/CLAUDE.md` | 인증 흐름, 환경변수, DB 스키마, KST 타임존, 유틸리티 모듈 |
| [docs/SPEC.md](docs/SPEC.md) | 프로젝트 요구사항 명세 |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | Agatha 디자인 시스템 |
| [docs/API.md](docs/API.md) | REST API 엔드포인트 상세 |
| [docs/COMPONENTS.md](docs/COMPONENTS.md) | UI 컴포넌트 사용 가이드 |
| [docs/BRAND.md](docs/BRAND.md) | Agatha 브랜드 가이드 |
| [docs/WORK_LOG.md](docs/WORK_LOG.md) | 작업 로그 인덱스 |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | 전체 변경 이력 |
| [docs/ERP_SYNC_SPEC.md](docs/ERP_SYNC_SPEC.md) | ERP 거래처 동기화 명세 |
| [docs/INTEGRATION_GUIDE.md](docs/INTEGRATION_GUIDE.md) | glitzy-web 연동 가이드 |
| [docs/SAMANTHA_ERP_CLIENT_GUIDE.md](docs/SAMANTHA_ERP_CLIENT_GUIDE.md) | ERP 거래처 매핑 가이드 |
