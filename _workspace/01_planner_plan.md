# Agatha 전체 구현 계획서

> Samantha (병원 마케팅 SaaS) -> Agatha (범용 마케팅 인텔리전스 대시보드) 전환

---

## Phase 0: 사전 정리 — 삭제 대상 제거

**목표**: 병원 전용 기능을 깨끗이 제거하여 빌드 에러 없는 클린 베이스를 확보한다.

**의존성**: 없음 (최초 단계)

### 0-1. 페이지/라우트 삭제

| 삭제 대상 | 경로 | 사유 |
|-----------|------|------|
| medichecker | `app/(dashboard)/medichecker/` | 의료광고 검수 — 병원 전용 |
| patients | `app/(dashboard)/patients/` | 예약/결제 — 병원 전용 |
| press | `app/(dashboard)/press/` | 언론보도 — 병원 전용 |
| staff | `app/(dashboard)/staff/` | 직원 관리 — 병원 전용 |
| erp-documents | `app/(dashboard)/erp-documents/` | 견적/계산서 — 병원 전용 |
| chatbot | `app/(dashboard)/chatbot/` | 챗봇 — 병원 전용 |
| bookings | `app/(dashboard)/bookings/` | 예약 — 병원 전용 |
| content | `app/(dashboard)/content/` | 인스타/유튜브 분석 — 삭제 |
| monitor (구) | `app/(dashboard)/monitor/` | 콘텐츠 모니터링 (구버전) — `/monitoring`으로 통합 |
| lead-form | `app/(dashboard)/lead-form/` | 분석 후 유지/삭제 판단 (landing-pages로 대체 가능 시 삭제) |
| demo enter/exit | `app/demo/enter/`, `app/demo/exit/` | 나중에 재구현 |
| login-logs (이동) | `app/(dashboard)/admin/login-logs/` | `/admin/settings`로 통합 |

### 0-2. API 라우트 삭제

| 삭제 대상 | 경로 |
|-----------|------|
| medichecker | `app/api/medichecker/` (전체) |
| patients | `app/api/patients/` (전체) |
| payments | `app/api/payments/` (전체) |
| press | `app/api/press/` (전체) |
| staff | `app/api/staff/` |
| bookings | `app/api/bookings/` |
| content | `app/api/content/` (전체) |
| erp-documents | `app/api/erp-documents/` (전체) |
| chatbot qstash | `app/api/qstash/chatbot/` |
| clinic-treatments | `app/api/clinic-treatments/` |
| cron/sync-press | `app/api/cron/sync-press/` |
| dashboard/treatment-revenue | `app/api/dashboard/treatment-revenue/` |
| seed (개발용) | `app/api/seed/` |
| external/ad-spend | `app/api/external/ad-spend/` |

### 0-3. 컴포넌트 삭제

| 삭제 대상 | 경로 |
|-----------|------|
| erp-documents | `components/erp-documents/` (전체) |
| medichecker | `components/medichecker/` (전체) |
| patients | `components/patients/` (전체) |
| dashboard/treatment-pie | `components/dashboard/treatment-pie.tsx` |

### 0-4. lib 삭제

| 삭제 대상 | 경로 | 사유 |
|-----------|------|------|
| medichecker | `lib/medichecker/` (전체) | 의료광고 검수 |
| ads-anomaly | `lib/ads-anomaly.ts` | 분석 후 판단 (유지 가능) |
| attribution-models | `lib/attribution-models.ts` | Agatha 어트리뷰션 모델로 대체 |
| services/erpClient | `lib/services/erpClient.ts` | ERP 연동 |
| services/pressSync | `lib/services/pressSync.ts` | 언론보도 |
| services/instagramContent | `lib/services/instagramContent.ts` | 인스타 분석 |
| services/youtubeContent | `lib/services/youtubeContent.ts` | 유튜브 분석 |
| demo/fixtures | `lib/demo/fixtures/` | 나중에 재생성 |
| demo/seed | `lib/demo/seed.ts` | 나중에 재생성 |

### 0-5. 패키지 삭제 (package.json)

| 패키지 | 사유 |
|--------|------|
| `@anthropic-ai/sdk` | medichecker AI 용 — 삭제 |
| `openai` | medichecker embedding 용 — 삭제 |
| `@dnd-kit/core` | patients 드래그앤드롭 — 삭제 |

### 0-6. 빌드 확인

- 삭제 후 `npm run build` 수행하여 import 에러 제거
- 깨진 import 경로를 하나씩 수정

---

## Phase 1: 도메인 리네이밍

**목표**: Samantha 병원 도메인 용어를 Agatha 범용 도메인 용어로 전환

**의존성**: Phase 0 완료

### 1-1. 용어 매핑

| Samantha | Agatha | 영향 범위 |
|----------|--------|----------|
| `clinic` | `client` | DB, API, 컴포넌트, 타입, 변수명 전체 |
| `clinic_id` | `client_id` | DB FK, API 파라미터, 세션 |
| `clinic_admin` | `client_admin` | 역할 코드, 권한 로직 |
| `clinic_staff` | `client_staff` | 역할 코드, 권한 로직 |
| `clinics` (테이블) | `clients` | DB 테이블명, 쿼리 전체 |
| `customer` | `contact` | DB 테이블명 (`customers` -> `contacts`) |
| `ClinicContext` | `ClientContext` | 컴포넌트, Provider, 훅 |
| `selectedClinicId` | `selectedClientId` | 프론트엔드 전역 상태 |
| `병원` (UI 텍스트) | `클라이언트` | UI 라벨, 메시지 |
| `samantha_selected_clinic` | `agatha_selected_client` | localStorage 키 |
| `username` (로그인) | `phone_number` (로그인) | 인증 시스템 |

### 1-2. 파일 변경 목록

| 파일/디렉토리 | 변경 내용 |
|--------------|----------|
| `app/(dashboard)/admin/clinics/` | 디렉토리명 → `admin/clients/` |
| `app/api/admin/clinics/` | 디렉토리명 → `admin/clients/` |
| `app/api/my/clinics/` | → `app/api/my/clients/` |
| `components/ClinicContext.tsx` | → `ClientContext.tsx`, 내부 용어 전환 |
| `components/admin/ClinicApiConfigDialog.tsx` | → `ClientApiConfigDialog.tsx` |
| `components/Sidebar.tsx` | `useClinic` → `useClient`, 메뉴 구조 변경 |
| `lib/api-middleware.ts` | `ClinicContext` → `ClientContext`, `clinicId` → `clientId` |
| `lib/session.ts` | `getClinicId` → `getClientId` |
| `lib/auth.ts` | 역할명 변경, `clinic_id` → `client_id` |
| `lib/supabase.ts` | 테이블 참조 변경 |
| `middleware.ts` | 역할명 변경 |
| 모든 API 라우트 | `clinic_id` 파라미터명 변경 |

### 1-3. DB 마이그레이션

```
새 마이그레이션: 20260416_rename_clinic_to_client.sql
- ALTER TABLE clinics RENAME TO clients;
- ALTER TABLE users RENAME COLUMN clinic_id TO client_id;
- ALTER TABLE customers RENAME TO contacts;
- contacts에 first_source, first_campaign_id, total_conversions, total_conversion_value 추가
- ALTER TABLE leads RENAME COLUMN clinic_id TO client_id;
  (leads 테이블의 모든 clinic_id FK)
- ALTER TABLE user_clinic_assignments RENAME TO user_client_assignments;
- 역할명 치환: clinic_admin → client_admin, clinic_staff → client_staff
- 인덱스 재생성
```

---

## Phase 2: 브랜딩/디자인 시스템 적용

**목표**: Samantha Blue → Agatha Slate+Violet 디자인 시스템 전환

**의존성**: Phase 1 완료 (리네이밍 후 브랜딩)

### 2-1. Tailwind 설정 변경

| 파일 | 변경 내용 |
|------|----------|
| `tailwind.config.ts` | `brand` 색상 Blue → Violet으로 교체. Slate 모노톤 추가 |
| `app/globals.css` | CSS 변수 재정의 (--primary → Violet-600 등) |

### 2-2. 폰트 변경

| 파일 | 변경 내용 |
|------|----------|
| `app/layout.tsx` | Inter → Pretendard + Geist Mono 폰트 로드 |
| `tailwind.config.ts` | `fontFamily.sans` → Pretendard, `fontFamily.mono` → Geist Mono |

### 2-3. 사이드바 리디자인

| 파일 | 변경 내용 |
|------|----------|
| `components/Sidebar.tsx` | 64px↔240px 토글 구현, 메뉴 구조 SPEC 기준 재배치 |
| `app/(dashboard)/layout.tsx` | 사이드바 토글 상태에 따른 콘텐츠 영역 마진 조정 |

### 2-4. 컴포넌트 스타일링

| 파일 | 변경 내용 |
|------|----------|
| `components/ui/*` | shadcn 기본 컴포넌트 Slate+Violet 테마 적용 |
| `components/common/stats-card.tsx` | KPI 카드 Geist Mono 숫자, Slate+Violet 스타일 |
| `components/common/status-badge.tsx` | 리드 상태 배지 색상 DESIGN_SYSTEM 기준 적용 |
| `lib/chart-colors.ts` | 차트 팔레트 Violet/Cyan/Amber/Teal/Rose/Slate 순서로 변경 |
| `components/common/empty-state.tsx` | 빈 상태 디자인 시스템 적용 |

### 2-5. 로그인/회원가입 페이지

| 파일 | 변경 내용 |
|------|----------|
| `app/login/page.tsx` | Agatha 브랜딩, 휴대폰 번호 입력 UI |
| `app/signup/page.tsx` | **신규 생성** — 초대 기반 회원가입 |

### 2-6. 다크모드

| 파일 | 변경 내용 |
|------|----------|
| `app/globals.css` | 다크모드 변수 DESIGN_SYSTEM 기준 재정의 |
| `components/ThemeToggle.tsx` | 글로우 효과 제거, 심플 토글 |

---

## Phase 3: 인증 시스템 변경

**목표**: username 로그인 → 휴대폰 번호 로그인, 초대 기반 회원가입

**의존성**: Phase 1 완료 (역할명 변경)

### 3-1. 인증 변경

| 파일 | 변경 내용 |
|------|----------|
| `lib/auth.ts` | `username` → `phone_number` 기반 인증, 역할명 변경 |
| `lib/rate-limit.ts` | 키 형식: IP:phone_number |
| DB | `users.username` 컬럼 삭제 또는 phone_number로 대체 확인 |

### 3-2. 초대 시스템 (신규)

| 파일 | 변경 내용 |
|------|----------|
| DB 마이그레이션 | `invitations` 테이블 생성 |
| `app/api/admin/invitations/route.ts` | **신규** — 초대 CRUD |
| `app/api/admin/invitations/[id]/route.ts` | **신규** — 초대 상세/취소 |
| `app/api/auth/signup/route.ts` | **신규** — 초대 토큰 검증 + 회원가입 |
| `app/signup/page.tsx` | **신규** — 초대 회원가입 페이지 |
| `middleware.ts` | `signup` 경로 인증 면제 추가 |

### 3-3. 권한 체계

| 파일 | 변경 내용 |
|------|----------|
| `lib/api-middleware.ts` | 새 역할 체계 적용 (superadmin/agency_staff/client_admin/client_staff/demo_viewer) |
| `lib/security.ts` | 권한 검증 로직 업데이트 |

---

## Phase 4: DB 스키마 변경

**목표**: Agatha SPEC에 맞는 데이터 모델 구축

**의존성**: Phase 1 (리네이밍), Phase 3 (인증 변경)

### 4-1. 테이블 변경/생성

| 작업 | 테이블 | 내용 |
|------|--------|------|
| 변경 | `clients` (구 clinics) | `monthly_budget` 확인, `notify_phones` 유지 |
| 변경 | `contacts` (구 customers) | `first_source`, `first_campaign_id`, `total_conversions`, `total_conversion_value` 추가 |
| 변경 | `leads` | `contact_id` FK 추가, `status` enum 확장 (new/in_progress/converted/lost/hold/invalid), `lost_reason`, `conversion_value`, `conversion_memo` 추가 |
| 생성 | `invitations` | 초대 토큰, 역할, 만료일 |
| 생성 | `budget_history` | 예산 변경 이력 (client_id, changed_at, old_budget, new_budget, memo) |
| 변경 | `ad_campaign_stats` | `campaign_type` 확인, UNIQUE 제약 확인 |
| 유지 | `landing_pages` | 그대로 유지 |
| 유지 | `utm_templates`, `utm_links` | 그대로 유지 |
| 유지 | `monitoring_keywords`, `monitoring_rankings` | 그대로 유지 |
| 유지 | `ad_creatives` | 그대로 유지 |
| 유지 | `activity_logs`, `login_logs`, `deleted_records` | 그대로 유지 |
| 유지 | `lead_raw_logs`, `capi_events` | 그대로 유지 |
| 유지 | `client_api_configs` (구 clinic_api_configs) | 리네이밍만 |
| 유지 | `user_client_assignments` | 리네이밍만 |
| 유지 | `user_menu_permissions` | 그대로 유지 |
| 유지 | `sms_send_logs` | 그대로 유지 |
| 유지 | `system_settings` | 그대로 유지 |
| 생성 | `client_notify_settings` | 클라이언트별 알림 설정 (알림 이벤트, 채널 선택) |

### 4-2. 삭제 대상 테이블

| 테이블 | 사유 |
|--------|------|
| `bookings` | 예약 — 병원 전용 |
| `consultations` | 상담 — 병원 전용 |
| `payments` | 결제 — 병원 전용 |
| `clinic_treatments` | 시술 카탈로그 — 병원 전용 |
| `press_coverage` | 언론보도 |
| `press_keywords` | 언론보도 키워드 |
| `mc_*` (전체) | medichecker 관련 |
| `oauth_states` | TikTok OAuth (유지 가능 — 판단 필요) |

---

## Phase 5: 신규 기능 구현

**목표**: Agatha SPEC의 신규 기능 구현

**의존성**: Phase 4 완료

### 5-1. 고객관리 통합 (리드 탭 + 고객DB 탭)

| 파일 | 변경 내용 |
|------|----------|
| `app/(dashboard)/customers/page.tsx` | **신규** — 탭 기반 통합 고객관리 페이지 |
| `app/(dashboard)/leads/` | **삭제** — `/customers`로 통합 |
| `components/customers/lead-tab.tsx` | **신규** — 리드 목록, 필터, 상태 입력 |
| `components/customers/contact-tab.tsx` | **신규** — 고객DB 목록, 이력 타임라인 |
| `components/customers/lead-detail-sheet.tsx` | **신규** — 리드 상세 시트 |
| `components/customers/contact-detail-sheet.tsx` | **신규** — 고객 상세 (유입 이력, 전환 타임라인) |
| `components/customers/manual-lead-form.tsx` | **신규** — 수동 리드 등록 (유입 경로 선택) |
| `app/api/customers/contacts/route.ts` | **신규** — 연락처 CRUD |
| `app/api/customers/contacts/[id]/route.ts` | **신규** — 연락처 상세 + 리드 이력 |

### 5-2. 대시보드 개편

| 파일 | 변경 내용 |
|------|----------|
| `app/(dashboard)/page.tsx` | KPI 카드(리드/전환/CPL/ROAS), 채널별 성과 테이블, 퍼널, 예산 소진, 트렌드 차트 |
| `components/dashboard/kpi-section.tsx` | 수정 — Agatha KPI 지표 |
| `components/dashboard/channel-table.tsx` | 수정 — 전환율/거부율/보류율/노쇼율 컬럼 추가 |
| `components/dashboard/funnel-section.tsx` | 수정 — New→InProgress→Converted + 보류/미전환 비율 |
| `components/dashboard/budget-gauge.tsx` | **신규** — 예산 소진 현황 위젯 |
| `app/api/dashboard/budget/route.ts` | **신규** — 예산 소진 데이터 |

### 5-3. 예산 관리 (수정 이력)

| 파일 | 변경 내용 |
|------|----------|
| `app/api/admin/clients/[id]/budget/route.ts` | **신규** — 예산 수정 + 이력 기록 |
| `app/api/admin/clients/[id]/budget/history/route.ts` | **신규** — 예산 변경 이력 조회 |
| 클라이언트 관리 페이지 | 예산 수정 다이얼로그에 사유 입력 추가, 이력 표시 |

### 5-4. 리포트 커스터마이징

| 파일 | 변경 내용 |
|------|----------|
| `app/api/admin/clients/[id]/report-settings/route.ts` | **신규** — 발송 주기/요일/시간/활성화 설정 |
| `app/api/cron/weekly-report/route.ts` | 수정 — 클라이언트별 설정 기반 발송 |
| `lib/services/weeklyReport.ts` | 수정 — Agatha KPI 기준 리포트 생성 |

### 5-5. 수동 등록 유입 경로

| 파일 | 변경 내용 |
|------|----------|
| `app/api/leads/route.ts` (POST) | 수정 — 수동 등록 시 utm_source에 phone/visit/referral/other 저장 |
| 수동 등록 폼 | 유입 경로 셀렉트 추가 (전화/방문/소개/기타) |

### 5-6. 초대 회원가입 (Phase 3에서 구현)

### 5-7. 광고 소재 관리 (기존 유지 + 보강)

| 파일 | 변경 내용 |
|------|----------|
| `app/(dashboard)/admin/ad-creatives/page.tsx` | A/B 비교 기능 추가 |

---

## Phase 6: 빌드 수정 및 통합 테스트

**목표**: 전체 빌드 성공 + 기능 통합 검증

**의존성**: Phase 5 완료

### 6-1. 빌드 수정

| 작업 | 내용 |
|------|------|
| import 정리 | 삭제된 모듈 참조 제거 |
| 타입 정의 갱신 | `next-auth.d.ts` 역할 타입, 세션 타입 |
| env 정리 | 불필요 환경변수 제거 (ANTHROPIC, OPENAI, NAVER_NEWS 등) |
| package.json | 삭제 패키지 정리, Pretendard/Geist Mono 폰트 패키지 추가 |
| CLAUDE.md | 프로젝트 문서 업데이트 |

### 6-2. 통합 테스트

| 검증 항목 |
|-----------|
| 로그인/회원가입 플로우 |
| 클라이언트 CRUD + 사용자 배정 |
| 초대 → 회원가입 → 로그인 |
| 리드 유입 (webhook, 랜딩페이지, 수동 등록) |
| 리드 상태 변경 + 전환 금액 입력 |
| 대시보드 KPI 계산 정확성 |
| 멀티테넌트 데이터 격리 |
| 역할별 접근 제어 |
| 광고 데이터 동기화 |
| 예산 수정 + 이력 조회 |

---

## Phase 7: 문서화

**목표**: 코드 문서 및 가이드 갱신

**의존성**: Phase 6 완료

| 작업 | 내용 |
|------|------|
| `CLAUDE.md` | 프로젝트 루트 문서 Agatha 기준 갱신 |
| `components/CLAUDE.md` | 컴포넌트 규칙 Agatha 기준 갱신 |
| `lib/CLAUDE.md` | lib 규칙 Agatha 기준 갱신 |
| `.claude/agents/*` | 에이전트 정의 갱신 |
| `docs/SPEC.md` | 구현 완료 체크리스트 업데이트 |

---

## Phase 의존성 다이어그램

```
Phase 0 (삭제)
    │
    ▼
Phase 1 (리네이밍) ──────────────┐
    │                            │
    ├─────────────┐              │
    ▼             ▼              ▼
Phase 2       Phase 3        Phase 4
(브랜딩)      (인증)         (DB 스키마)
    │             │              │
    └──────┬──────┘──────────────┘
           ▼
       Phase 5 (신규 기능)
           │
           ▼
       Phase 6 (빌드/테스트)
           │
           ▼
       Phase 7 (문서화)
```

**Phase 2, 3, 4는 Phase 1 완료 후 병렬 실행 가능**

---

## 예상 파일 변경 요약

| 카테고리 | 삭제 | 수정 | 신규 |
|----------|------|------|------|
| 페이지 (app/) | ~15 | ~10 | ~3 |
| API 라우트 | ~20 | ~15 | ~10 |
| 컴포넌트 | ~15 | ~20 | ~10 |
| lib 유틸 | ~10 | ~10 | ~3 |
| DB 마이그레이션 | — | — | ~3 |
| 설정 파일 | — | ~5 | — |
| **합계** | **~60** | **~60** | **~26** |
