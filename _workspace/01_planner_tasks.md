# Agatha 작업 분해 목록

> 우선순위: P0(필수/즉시) P1(중요/다음) P2(나중에)
> 복잡도: S(작음/1-2h) M(보통/반일) L(큼/하루+)
> 병렬: FE=프론트엔드, BE=백엔드, FE+BE=동시 가능

---

## Phase 0: 삭제 — 클린 베이스 확보

### Frontend 작업

| ID | 작업 | 우선순위 | 복잡도 | 병렬 |
|----|------|----------|--------|------|
| F0-1 | `app/(dashboard)/medichecker/` 삭제 | P0 | S | FE |
| F0-2 | `app/(dashboard)/patients/` 삭제 | P0 | S | FE |
| F0-3 | `app/(dashboard)/press/` 삭제 | P0 | S | FE |
| F0-4 | `app/(dashboard)/staff/` 삭제 | P0 | S | FE |
| F0-5 | `app/(dashboard)/erp-documents/` 삭제 | P0 | S | FE |
| F0-6 | `app/(dashboard)/chatbot/` 삭제 | P0 | S | FE |
| F0-7 | `app/(dashboard)/bookings/` 삭제 | P0 | S | FE |
| F0-8 | `app/(dashboard)/content/` 삭제 | P0 | S | FE |
| F0-9 | `app/(dashboard)/monitor/` 삭제 (구버전, /monitoring 유지) | P0 | S | FE |
| F0-10 | `app/(dashboard)/lead-form/` 삭제 | P0 | S | FE |
| F0-11 | `app/demo/` 삭제 | P1 | S | FE |
| F0-12 | `components/erp-documents/` 삭제 | P0 | S | FE |
| F0-13 | `components/medichecker/` 삭제 | P0 | S | FE |
| F0-14 | `components/patients/` 삭제 | P0 | S | FE |
| F0-15 | `components/dashboard/treatment-pie.tsx` 삭제 | P0 | S | FE |
| F0-16 | `components/Sidebar.tsx` — 삭제 메뉴 항목 제거 (medichecker, patients, press, staff, erp-documents, chatbot, bookings, content, monitor) | P0 | S | FE |

### Backend 작업

| ID | 작업 | 우선순위 | 복잡도 | 병렬 |
|----|------|----------|--------|------|
| B0-1 | `app/api/medichecker/` 삭제 | P0 | S | BE |
| B0-2 | `app/api/patients/` 삭제 | P0 | S | BE |
| B0-3 | `app/api/payments/` 삭제 | P0 | S | BE |
| B0-4 | `app/api/press/` 삭제 | P0 | S | BE |
| B0-5 | `app/api/staff/` 삭제 | P0 | S | BE |
| B0-6 | `app/api/bookings/` 삭제 | P0 | S | BE |
| B0-7 | `app/api/content/` 삭제 | P0 | S | BE |
| B0-8 | `app/api/erp-documents/` 삭제 | P0 | S | BE |
| B0-9 | `app/api/qstash/chatbot/` 삭제 | P0 | S | BE |
| B0-10 | `app/api/clinic-treatments/` 삭제 | P0 | S | BE |
| B0-11 | `app/api/cron/sync-press/` 삭제 | P0 | S | BE |
| B0-12 | `app/api/dashboard/treatment-revenue/` 삭제 | P0 | S | BE |
| B0-13 | `app/api/seed/` 삭제 | P1 | S | BE |
| B0-14 | `app/api/external/ad-spend/` 삭제 | P1 | S | BE |
| B0-15 | `lib/medichecker/` 삭제 | P0 | S | BE |
| B0-16 | `lib/services/erpClient.ts` 삭제 | P0 | S | BE |
| B0-17 | `lib/services/pressSync.ts` 삭제 | P0 | S | BE |
| B0-18 | `lib/services/instagramContent.ts` 삭제 | P0 | S | BE |
| B0-19 | `lib/services/youtubeContent.ts` 삭제 | P0 | S | BE |
| B0-20 | `lib/demo/` 삭제 (fixtures, seed) | P1 | S | BE |
| B0-21 | `package.json` — 불필요 패키지 제거 (@anthropic-ai/sdk, openai, @dnd-kit/core) | P0 | S | BE |

### QA 작업

| ID | 작업 | 우선순위 | 복잡도 |
|----|------|----------|--------|
| Q0-1 | 삭제 후 `npm run build` 성공 확인 | P0 | M |
| Q0-2 | 깨진 import 경로 수정 | P0 | M |
| Q0-3 | 남은 페이지 정상 렌더링 확인 | P0 | S |

> **Phase 0 소계**: FE 16건, BE 21건, QA 3건 — **FE+BE 완전 병렬 가능**

---

## Phase 1: 도메인 리네이밍

### Frontend 작업

| ID | 작업 | 우선순위 | 복잡도 | 병렬 |
|----|------|----------|--------|------|
| F1-1 | `components/ClinicContext.tsx` → `ClientContext.tsx` (파일명 + 내부 용어) | P0 | M | FE |
| F1-2 | `components/admin/ClinicApiConfigDialog.tsx` → `ClientApiConfigDialog.tsx` | P0 | S | FE |
| F1-3 | `app/(dashboard)/admin/clinics/` → `admin/clients/` (디렉토리 + 내용) | P0 | M | FE |
| F1-4 | `components/Sidebar.tsx` — `useClinic` → `useClient`, 병원 → 클라이언트 | P0 | S | FE |
| F1-5 | 모든 프론트엔드 파일에서 `clinic` → `client` 일괄 치환 | P0 | L | FE |
| F1-6 | localStorage 키 `samantha_selected_clinic` → `agatha_selected_client` | P0 | S | FE |
| F1-7 | UI 텍스트 "병원" → "클라이언트" 전체 치환 | P0 | M | FE |

### Backend 작업

| ID | 작업 | 우선순위 | 복잡도 | 병렬 |
|----|------|----------|--------|------|
| B1-1 | `app/api/admin/clinics/` → `admin/clients/` (디렉토리 + 내용) | P0 | M | BE |
| B1-2 | `app/api/my/clinics/` → `my/clients/` | P0 | S | BE |
| B1-3 | `lib/api-middleware.ts` — ClinicContext → ClientContext, clinicId → clientId | P0 | M | BE |
| B1-4 | `lib/session.ts` — getClinicId → getClientId | P0 | S | BE |
| B1-5 | `lib/auth.ts` — 역할명 변경, clinic_id → client_id | P0 | M | BE |
| B1-6 | 모든 API 라우트에서 `clinic_id` → `client_id` 파라미터명 변경 | P0 | L | BE |
| B1-7 | `next-auth.d.ts` 타입 정의 업데이트 | P0 | S | BE |

### DB 작업

| ID | 작업 | 우선순위 | 복잡도 | 병렬 |
|----|------|----------|--------|------|
| D1-1 | 마이그레이션: clinics → clients 테이블 리네이밍 | P0 | L | BE |
| D1-2 | 마이그레이션: 모든 FK clinic_id → client_id | P0 | L | BE |
| D1-3 | 마이그레이션: customers → contacts 테이블 리네이밍 + 컬럼 추가 | P0 | L | BE |
| D1-4 | 마이그레이션: 역할명 치환 (clinic_admin → client_admin 등) | P0 | M | BE |
| D1-5 | 마이그레이션: user_clinic_assignments → user_client_assignments | P0 | S | BE |
| D1-6 | 마이그레이션: clinic_api_configs → client_api_configs | P0 | S | BE |

### QA 작업

| ID | 작업 | 우선순위 | 복잡도 |
|----|------|----------|--------|
| Q1-1 | 리네이밍 후 빌드 성공 확인 | P0 | M |
| Q1-2 | DB 마이그레이션 적용 후 기존 데이터 정합성 확인 | P0 | M |
| Q1-3 | 모든 API 엔드포인트 client_id 기반 동작 확인 | P0 | M |

> **Phase 1 소계**: FE 7건, BE 13건, QA 3건 — **FE+BE 병렬 가능 (DB 마이그레이션은 BE 선행)**

---

## Phase 2: 브랜딩/디자인 시스템

### Frontend 작업

| ID | 작업 | 우선순위 | 복잡도 | 병렬 |
|----|------|----------|--------|------|
| F2-1 | `tailwind.config.ts` — brand 색상 Blue→Violet, Slate 추가 | P0 | M | FE |
| F2-2 | `app/globals.css` — CSS 변수 Agatha 테마로 전면 교체 | P0 | M | FE |
| F2-3 | `app/layout.tsx` — Pretendard + Geist Mono 폰트 로드 | P0 | M | FE |
| F2-4 | `components/Sidebar.tsx` — 64px↔240px 토글, Agatha 메뉴 구조, Lucide 아이콘 | P0 | L | FE |
| F2-5 | `app/(dashboard)/layout.tsx` — 사이드바 토글 연동 레이아웃 | P0 | M | FE |
| F2-6 | `components/common/stats-card.tsx` — KPI 카드 Geist Mono 숫자, 증감 표시 | P0 | M | FE |
| F2-7 | `components/common/status-badge.tsx` — 리드 상태 배지 색상 (Violet/Amber/Emerald/Slate/Rose) | P0 | S | FE |
| F2-8 | `lib/chart-colors.ts` — 차트 팔레트 Violet/Cyan/Amber/Teal/Rose/Slate | P0 | S | FE |
| F2-9 | `components/ui/*` — shadcn 컴포넌트 Slate+Violet 미세 조정 | P1 | M | FE |
| F2-10 | `app/globals.css` — 다크모드 변수 DESIGN_SYSTEM 기준 | P1 | M | FE |
| F2-11 | `components/ThemeToggle.tsx` — 글로우 제거, 심플 토글 | P1 | S | FE |
| F2-12 | `app/login/page.tsx` — Agatha 브랜딩, 휴대폰 번호 입력 UI | P0 | M | FE |
| F2-13 | `app/icon.tsx`, `app/apple-icon.tsx` — Agatha 아이콘 | P2 | S | FE |
| F2-14 | `components/common/empty-state.tsx` — 빈 상태 DESIGN_SYSTEM 적용 | P1 | S | FE |
| F2-15 | 로딩 스켈레톤 Slate 색상 적용 | P1 | S | FE |

### QA 작업

| ID | 작업 | 우선순위 | 복잡도 |
|----|------|----------|--------|
| Q2-1 | 모든 페이지 시각적 검수 (라이트모드) | P0 | M |
| Q2-2 | 다크모드 전체 검수 | P1 | M |
| Q2-3 | 모바일 반응형 검수 (sm/md 브레이크포인트) | P1 | M |
| Q2-4 | 사이드바 토글 축소/확장 동작 확인 | P0 | S |

> **Phase 2 소계**: FE 15건, QA 4건 — **Phase 1 완료 후, 다른 Phase와 병렬 가능**

---

## Phase 3: 인증 시스템

### Frontend 작업

| ID | 작업 | 우선순위 | 복잡도 | 병렬 |
|----|------|----------|--------|------|
| F3-1 | `app/login/page.tsx` — 휴대폰 번호 로그인 폼 (010-XXXX-XXXX 포맷) | P0 | M | FE |
| F3-2 | `app/signup/page.tsx` — **신규** 초대 회원가입 페이지 | P0 | L | FE |
| F3-3 | `middleware.ts` — signup 경로 인증 면제 | P0 | S | FE |

### Backend 작업

| ID | 작업 | 우선순위 | 복잡도 | 병렬 |
|----|------|----------|--------|------|
| B3-1 | `lib/auth.ts` — username → phone_number 인증 | P0 | M | BE |
| B3-2 | `app/api/auth/signup/route.ts` — **신규** 초대 회원가입 API | P0 | L | BE |
| B3-3 | `app/api/admin/invitations/route.ts` — **신규** 초대 CRUD | P0 | L | BE |
| B3-4 | `app/api/admin/invitations/[id]/route.ts` — **신규** 초대 취소 | P0 | M | BE |
| B3-5 | `app/api/admin/invitations/[id]/resend/route.ts` — **신규** 초대 재발송 | P1 | M | BE |
| B3-6 | `lib/rate-limit.ts` — 키 형식 IP:phone_number | P0 | S | BE |

### DB 작업

| ID | 작업 | 우선순위 | 복잡도 | 병렬 |
|----|------|----------|--------|------|
| D3-1 | 마이그레이션: `invitations` 테이블 생성 | P0 | M | BE |
| D3-2 | 마이그레이션: `users` 테이블 phone_number 기반으로 확인/조정 | P0 | M | BE |

### QA 작업

| ID | 작업 | 우선순위 | 복잡도 |
|----|------|----------|--------|
| Q3-1 | 휴대폰 번호 로그인 플로우 | P0 | S |
| Q3-2 | 초대 생성 → 링크 접속 → 회원가입 → 로그인 전체 플로우 | P0 | M |
| Q3-3 | 초대 만료/취소 처리 확인 | P0 | S |
| Q3-4 | client_admin → client_staff 초대 권한 격리 | P0 | S |

> **Phase 3 소계**: FE 3건, BE 8건, QA 4건 — **FE+BE API 계약 기반 병렬 가능**

---

## Phase 4: DB 스키마 변경

### DB 작업

| ID | 작업 | 우선순위 | 복잡도 | 병렬 |
|----|------|----------|--------|------|
| D4-1 | 마이그레이션: `leads` 테이블 — contact_id FK, status enum 확장, lost_reason, conversion_value, conversion_memo | P0 | L | BE |
| D4-2 | 마이그레이션: `budget_history` 테이블 생성 | P0 | M | BE |
| D4-3 | 마이그레이션: `client_notify_settings` 테이블 생성 | P1 | M | BE |
| D4-4 | 마이그레이션: 삭제 테이블 (bookings, consultations, payments, clinic_treatments, press_*, mc_*) | P0 | M | BE |
| D4-5 | 인덱스 생성 (contacts, leads, ad_campaign_stats) | P0 | M | BE |

### QA 작업

| ID | 작업 | 우선순위 | 복잡도 |
|----|------|----------|--------|
| Q4-1 | 마이그레이션 적용 후 기존 데이터 무결성 확인 | P0 | M |
| Q4-2 | FK 관계 정확성 검증 | P0 | S |

> **Phase 4 소계**: DB 5건, QA 2건

---

## Phase 5: 신규 기능 구현

### 5-1. 고객관리 통합

#### Frontend

| ID | 작업 | 우선순위 | 복잡도 | 병렬 |
|----|------|----------|--------|------|
| F5-1 | `app/(dashboard)/customers/page.tsx` — 탭 기반 고객관리 페이지 (리드/고객DB) | P0 | L | FE+BE |
| F5-2 | `components/customers/lead-tab.tsx` — 리드 목록 (상태필터, 채널필터, 기간필터) | P0 | L | FE |
| F5-3 | `components/customers/contact-tab.tsx` — 고객DB 목록 | P0 | M | FE |
| F5-4 | `components/customers/lead-detail-sheet.tsx` — 리드 상세 (상태 변경, 전환 입력) | P0 | L | FE |
| F5-5 | `components/customers/contact-detail-sheet.tsx` — 고객 상세 (이력 타임라인) | P0 | M | FE |
| F5-6 | `components/customers/manual-lead-form.tsx` — 수동 리드 등록 (유입 경로 선택) | P0 | M | FE |
| F5-7 | `app/(dashboard)/leads/` 삭제 (customers로 통합) | P0 | S | FE |

#### Backend

| ID | 작업 | 우선순위 | 복잡도 | 병렬 |
|----|------|----------|--------|------|
| B5-1 | `app/api/leads/route.ts` 수정 — contact 자동 연결, status enum, 수동 등록 유입 경로 | P0 | L | BE |
| B5-2 | `app/api/leads/[id]/route.ts` 수정 — PATCH: 전환 결과 + contact 업데이트 | P0 | L | BE |
| B5-3 | `app/api/customers/contacts/route.ts` — **신규** 연락처 목록 | P0 | M | BE |
| B5-4 | `app/api/customers/contacts/[id]/route.ts` — **신규** 연락처 상세 + 리드 이력 | P0 | M | BE |
| B5-5 | `app/api/webhook/lead/route.ts` 수정 — contact 자동 연결 | P0 | M | BE |

### 5-2. 대시보드 개편

#### Frontend

| ID | 작업 | 우선순위 | 복잡도 | 병렬 |
|----|------|----------|--------|------|
| F5-8 | `app/(dashboard)/page.tsx` — Agatha 대시보드 레이아웃 (KPI, 채널, 퍼널, 예산, 트렌드) | P0 | L | FE+BE |
| F5-9 | `components/dashboard/kpi-section.tsx` 수정 — 리드/전환/CPL/ROAS 카드 | P0 | M | FE |
| F5-10 | `components/dashboard/channel-table.tsx` 수정 — 전환율/거부율/보류율/노쇼율 | P0 | M | FE |
| F5-11 | `components/dashboard/funnel-section.tsx` 수정 — New→InProgress→Converted | P0 | M | FE |
| F5-12 | `components/dashboard/budget-gauge.tsx` — **신규** 예산 소진 위젯 | P0 | M | FE |

#### Backend

| ID | 작업 | 우선순위 | 복잡도 | 병렬 |
|----|------|----------|--------|------|
| B5-6 | `app/api/dashboard/kpi/route.ts` 수정 — Agatha KPI 계산 | P0 | L | BE |
| B5-7 | `app/api/dashboard/channel/route.ts` 수정 — 전환율/거부율 등 추가 | P0 | M | BE |
| B5-8 | `app/api/dashboard/funnel/route.ts` 수정 — 6단계 퍼널 | P0 | M | BE |
| B5-9 | `app/api/dashboard/budget/route.ts` — **신규** 예산 소진 데이터 | P0 | M | BE |

### 5-3. 예산 관리

#### Frontend

| ID | 작업 | 우선순위 | 복잡도 | 병렬 |
|----|------|----------|--------|------|
| F5-13 | 클라이언트 관리 — 예산 수정 다이얼로그 (사유 입력) | P1 | M | FE+BE |
| F5-14 | 클라이언트 관리 — 예산 변경 이력 표시 | P1 | M | FE |

#### Backend

| ID | 작업 | 우선순위 | 복잡도 | 병렬 |
|----|------|----------|--------|------|
| B5-10 | `app/api/admin/clients/[id]/budget/route.ts` — **신규** 예산 수정 + 이력 기록 | P1 | M | BE |
| B5-11 | `app/api/admin/clients/[id]/budget/history/route.ts` — **신규** 이력 조회 | P1 | S | BE |

### 5-4. 리포트 커스터마이징

#### Frontend

| ID | 작업 | 우선순위 | 복잡도 | 병렬 |
|----|------|----------|--------|------|
| F5-15 | 설정 페이지 — 클라이언트별 리포트 발송 설정 UI | P1 | M | FE+BE |

#### Backend

| ID | 작업 | 우선순위 | 복잡도 | 병렬 |
|----|------|----------|--------|------|
| B5-12 | `app/api/admin/clients/[id]/report-settings/route.ts` — **신규** | P1 | M | BE |
| B5-13 | `app/api/cron/weekly-report/route.ts` 수정 — 설정 기반 발송 | P1 | L | BE |
| B5-14 | `lib/services/weeklyReport.ts` 수정 — Agatha KPI 리포트 | P1 | L | BE |

### 5-5. 광고 소재 A/B 비교

| ID | 작업 | 우선순위 | 복잡도 | 병렬 |
|----|------|----------|--------|------|
| F5-16 | `app/(dashboard)/admin/ad-creatives/page.tsx` — A/B 비교 기능 | P2 | M | FE |

### QA 작업

| ID | 작업 | 우선순위 | 복잡도 |
|----|------|----------|--------|
| Q5-1 | 리드 수동 등록 → contact 자동 연결 확인 | P0 | S |
| Q5-2 | 리드 상태 변경 (전환 + 금액) → contact 누적 계산 확인 | P0 | M |
| Q5-3 | 대시보드 KPI 수치 정확성 (CPL, ROAS, CVR 계산) | P0 | L |
| Q5-4 | 채널별 전환율/거부율/보류율 정확성 | P0 | M |
| Q5-5 | 퍼널 시각화 데이터 일치 확인 | P0 | S |
| Q5-6 | 예산 수정 + 이력 저장/조회 | P1 | S |
| Q5-7 | 수동 등록 유입 경로 (phone/visit/referral/other) 저장 확인 | P0 | S |
| Q5-8 | CSV 내보내기 Agatha 스키마 반영 확인 | P1 | S |
| Q5-9 | 리포트 자동 발송 (주간/월간 설정 기반) | P1 | M |
| Q5-10 | 고객DB 탭 — 고객별 리드 이력 타임라인 | P0 | S |

> **Phase 5 소계**: FE 16건, BE 14건, QA 10건

---

## Phase 6: 빌드 수정 및 통합 테스트

### 작업

| ID | 작업 | 우선순위 | 복잡도 | 병렬 |
|----|------|----------|--------|------|
| I6-1 | 전체 import 정리 (깨진 참조 수정) | P0 | M | FE+BE |
| I6-2 | `next-auth.d.ts` 타입 최종 확인 | P0 | S | BE |
| I6-3 | `.env.example` 정리 (불필요 환경변수 제거) | P0 | S | BE |
| I6-4 | `package.json` 최종 정리 (font 패키지 추가 등) | P0 | S | BE |
| I6-5 | `npm run build` 최종 성공 확인 | P0 | M | FE+BE |
| I6-6 | ESLint 에러 정리 | P1 | M | FE+BE |

### 통합 QA

| ID | 작업 | 우선순위 | 복잡도 |
|----|------|----------|--------|
| Q6-1 | 전체 로그인 → 대시보드 → 기능 플로우 (superadmin) | P0 | L |
| Q6-2 | client_admin 역할 접근 제어 검증 | P0 | M |
| Q6-3 | client_staff 역할 접근 제어 검증 | P0 | M |
| Q6-4 | agency_staff 역할 배정 클라이언트 격리 | P0 | M |
| Q6-5 | 멀티테넌트 데이터 격리 (클라이언트 간 누출 없음) | P0 | L |
| Q6-6 | 광고 데이터 동기화 (cron + 수동) | P0 | M |
| Q6-7 | 웹훅 리드 수신 → 알림 발송 | P0 | M |
| Q6-8 | 랜딩페이지 → 리드 생성 → 알림 | P0 | M |

> **Phase 6 소계**: 빌드 6건, QA 8건

---

## Phase 7: 문서화

| ID | 작업 | 우선순위 | 복잡도 |
|----|------|----------|--------|
| D7-1 | 루트 `CLAUDE.md` Agatha 기준 갱신 | P1 | M |
| D7-2 | `components/CLAUDE.md` 갱신 | P1 | S |
| D7-3 | `lib/CLAUDE.md` 갱신 | P1 | M |
| D7-4 | `.claude/agents/*.md` 갱신 | P2 | S |
| D7-5 | `docs/SPEC.md` 구현 체크리스트 업데이트 | P1 | S |

> **Phase 7 소계**: 5건

---

## 전체 요약

| Phase | FE | BE/DB | QA | 합계 | 병렬 가능 |
|-------|----|----|----|----|----------|
| Phase 0: 삭제 | 16 | 21 | 3 | 40 | FE+BE 완전 병렬 |
| Phase 1: 리네이밍 | 7 | 13 | 3 | 23 | FE+BE 병렬 (DB 선행) |
| Phase 2: 브랜딩 | 15 | 0 | 4 | 19 | FE 단독 (Phase 3,4와 병렬) |
| Phase 3: 인증 | 3 | 8 | 4 | 15 | FE+BE 병렬 |
| Phase 4: DB | 0 | 5 | 2 | 7 | BE 단독 (Phase 2,3과 병렬) |
| Phase 5: 신규기능 | 16 | 14 | 10 | 40 | FE+BE API 계약 기반 병렬 |
| Phase 6: 빌드/QA | 6 | 0 | 8 | 14 | — |
| Phase 7: 문서화 | 0 | 0 | 0 | 5 | — |
| **합계** | **63** | **61** | **34** | **163** | |

### 크리티컬 패스

```
Phase 0 (1일) → Phase 1 (2일) → Phase 4 (1일) → Phase 5 (4일) → Phase 6 (2일)
                                    ↑ 병렬 ↑
                              Phase 2 (2일)
                              Phase 3 (2일)
```

**최적 소요: 약 10~12일** (FE/BE 2인 병렬 기준)

### P0 작업 우선순위 실행 순서

1. Phase 0 전체 (삭제) — 빌드 클린업
2. Phase 1 전체 (리네이밍) — 도메인 기반 확립
3. Phase 2 F2-1~F2-8 + Phase 3 B3-1~B3-3 + Phase 4 D4-1~D4-5 (병렬)
4. Phase 5 고객관리(5-1) + 대시보드(5-2) (P0 핵심 기능)
5. Phase 6 빌드 확인 + 통합 QA
