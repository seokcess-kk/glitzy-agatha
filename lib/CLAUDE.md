# lib/ 핵심 유틸리티 규칙

## 인증 흐름 (lib/auth.ts)

```
사용자 → NextAuth Credentials → authorize()
  ├─ Rate Limit: IP:username 키, 15분/5회 (lib/rate-limit.ts)
  ├─ DB 사용자 조회 + bcrypt 검증
  ├─ 로그인 로그 기록 (login_logs, non-blocking)
  └─ JWT 발급 (password_version 포함)
```

- 세션 무효화: 비밀번호 변경 → `password_version` 증가 → `getAuthUser()`에서 불일치 시 401
- IP/UA 전달: `route.ts`에서 `setRequestContext()` → `authorize()`에서 사용
- 미들웨어(`middleware.ts`): 인증 불필요 경로 = `api/`, `login`, `lp`

## 환경변수

### 필수
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- `CRON_SECRET` (Cron Job 인증)

### 선택 (서비스별)
- 광고: `GOOGLE_ADS_*`, `META_*`, `TIKTOK_ADVERTISER_ID`, `TIKTOK_ACCESS_TOKEN` (+ 병원별 `clinic_api_configs`)
- 콘텐츠: `YOUTUBE_API_KEY`, `KAKAO_REST_API_KEY`
- AI: `ANTHROPIC_API_KEY`
- SMS: `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SOLAPI_SENDER_NUMBER`
- 메시징: `QSTASH_*`, `KAKAO_*`
- 뉴스: `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` (네이버 뉴스 검색 API)
- 에러 알림: `ADMIN_ALERT_PHONES` (프로덕션 에러 SMS 수신 번호)
- 외부 API: `EXTERNAL_SERVICE_KEY` (glitzy-web → Samantha 인증)

## DB 핵심 테이블

| 테이블 | 용도 | 비고 |
|--------|------|------|
| `clinics` | 병원 고객사 | `notify_phones TEXT[]` 최대 3개 |
| `users` | 로그인 계정 | role: superadmin/agency_staff/clinic_admin/clinic_staff |
| `customers` | 고객 (CDP) | `phone_number`로 식별 |
| `leads` | 리드/문의 | UTM, `landing_page_id`, `updated_by` |
| `bookings` | 예약 | `created_by`, `updated_by` |
| `consultations` | 상담 | `created_by`, `updated_by` |
| `payments` | 결제 | `created_by` |
| `ad_campaign_stats` | 캠페인 레벨 광고 통계 | 일별 집계 |
| `ad_stats` | 광고(ad) 레벨 성과 | Meta: utm_content 매핑, TikTok: ad_id 기준 (utm_content=null) |
| `clinic_api_configs` | 병원별 광고 API 키 | |
| `landing_pages` | 랜딩 페이지 | 8자리 랜덤 ID |
| `lead_raw_logs` | 리드 원본 로그 | 멱등성 키로 유실 방지 |
| `sms_send_logs` | SMS 발송 로그 | status: sent/retrying/failed |
| `activity_logs` | 활동 이력 | 누가 무엇을 변경했는지 |
| `user_clinic_assignments` | agency_staff 병원 배정 | |
| `user_menu_permissions` | agency_staff 메뉴 권한 | |
| `monitoring_keywords` | 순위 모니터링 키워드 | place/website/smartblock |
| `monitoring_rankings` | 일별 순위 데이터 | keyword_id + rank_date UNIQUE |
| `login_logs` | 로그인 시도 이력 | IP, success, failure_reason |
| `deleted_records` | 삭제 데이터 스냅샷 보관 | 감사/복구용 |
| `capi_events` | Meta CAPI 전송 로그 | status: pending/success/fail, event_id로 중복 제거 |
| `oauth_states` | OAuth CSRF state 임시 저장 | 10분 만료, 일회용 (TikTok 등) |
| `clinic_treatments` | 병원별 시술 메뉴 카탈로그 | POS형 결제 입력용, UNIQUE(clinic_id, name) |
| `press_coverage` | 언론보도 기사 | Google News RSS 수집, UNIQUE(clinic_id, url) |
| `press_keywords` | 언론보도 검색 키워드 | 병원당 최대 5개, UNIQUE(clinic_id, keyword) |
| `mc_law_articles` | 의료광고법 조문 (공용) | 15개 법조문, keywords 정규식 패턴 |
| `mc_procedures` | 의료 시술 정보 (공용) | 50개 시술, aliases/부작용/규제 |
| `mc_relations` | 법령-시술 온톨로지 관계 (공용) | 8종 관계 타입, 1홉 탐색 |
| `mc_chunks` | RAG 임베딩 청크 (공용) | pgvector 1536차원, pg_trgm 키워드 |
| `mc_verification_logs` | 광고 검증 이력 (테넌트) | clinic_id + user_id 추적, violations JSONB |
| `system_settings` | 시스템 전역 설정 (공용) | key(PK) + value(JSONB). 예: hidden_menus |

## 외부 API (inbound)

glitzy-web 등 외부 서비스가 Samantha 데이터를 조회하는 엔드포인트.
`withExternalAuth` 미들웨어 사용 — `EXTERNAL_SERVICE_KEY` Bearer 토큰 검증.

| 엔드포인트 | 용도 |
|-----------|------|
| `GET /api/external/ad-spend` | 병원별 월간 광고 실집행비 + SMS 건수 |

## SMS 발송 (lib/solapi.ts)

- `sendSmsWithLog()`: 발송 + DB 로그 기록. 실패 시 `logId` 반환
- 실패 시 `/api/qstash/sms-retry`로 자동 재시도 (최대 3회, 3분→5분 간격)
- 병원별 알림 연락처: `clinics.notify_phones TEXT[]` 최대 3개

## 유틸리티 모듈 요약

| 모듈 | 핵심 export | 용도 |
|------|------------|------|
| `api-middleware.ts` | `withAuth`, `withClinicFilter`, `apiSuccess`, `apiError`, `applyClinicFilter`, `applyDateRange` | API 인증/필터 래퍼 + 쿼리 필터 헬퍼 |
| `security.ts` | `parseId`, `sanitizeString`, `sanitizeUrl`, `canModifyBooking` | 입력 검증/권한 체크. URL에는 `sanitizeUrl` 사용 (`&` 보존) |
| `logger.ts` | `createLogger` | 환경별 로깅 (dev=readable, prod=JSON) |
| `api-client.ts` | `fetchJSON`, `fetchWithRetry` | 외부 API 호출 (재시도+타임아웃) |
| `utm.ts` | `parseUtmFromUrl`, `sanitizeUtmParams`, `mergeUtmParams` | UTM 파싱/검증 |
| `activity-log.ts` | `logActivity` | 활동 이력 기록 (non-blocking) |
| `solapi.ts` | `sendSmsWithLog` | SMS 발송 + 로그 |
| `rate-limit.ts` | Rate Limit | IP:username 기반 제한 |
| `error-alert.ts` | `sendErrorAlert` | 프로덕션 에러 → 관리자 SMS (쿨다운 5분, 일일 50건) |
| `archive.ts` | `archiveBeforeDelete`, `archiveBulkBeforeDelete` | 삭제 전 스냅샷 보관 |
| `platform.ts` | `API_PLATFORMS`, `CREATIVE_PLATFORMS`, `CAMPAIGN_TYPES_BY_PLATFORM`, `isApiPlatform` 등 | 광고 플랫폼 & 캠페인 타입 중앙 상수 (Single Source of Truth) |
| `channel.ts` | `normalizeChannel` | utm_source/platform → canonical 채널명 (Meta, Google 등). `meta_ads` 형식도 인식 |
| `channel-colors.ts` | `getChannelColor` | 채널별 Recharts 색상 코드 (Dable: indigo-500 포함) |
| `chart-colors.ts` | `CHART_PALETTE`, `CHART_SEMANTIC`, `PIE_SHADES`, `BAR_COLORS`, `FUNNEL_COLORS`, `FUNNEL_GRADIENT` | Recharts 차트 컬러 중앙 상수 |
| `date.ts` | `formatDate`, `toUtcDate`, `getKstDateString`, `getKstDayStartISO`, `getKstDayEndISO` | KST 기준 날짜 포맷/생성 (아래 타임존 규칙 참조) |
| `services/metaAds.ts` | `fetchMetaAds`, `fetchMetaAdStats` | Meta 캠페인 + ad 레벨 수집 (ad_stats: utm_content 자동 매핑) |
| `services/tiktokAds.ts` | `fetchTikTokAds`, `fetchTikTokAdStats` | TikTok 캠페인 + ad 레벨 수집 (페이지네이션, 공통 헬퍼 `fetchTikTokReport`) |
| `services/metaCapi.ts` | Meta CAPI 전송 | 리드 유입 시 서버사이드 전환 이벤트 전송 |
| `services/pressSync.ts` | `syncPressForClinic` | 언론보도 수집 (다중 키워드 → Google News RSS → upsert) |
| `services/erpClient.ts` | `fetchQuotes`, `fetchInvoices`, `respondToQuote` 등 | glitzy-web ERP 외부 API 프록시 (fetchJSON 기반, GET/PATCH 지원) |
| `medichecker/types.ts` | 전체 타입 정의 | VerifyRequest, Violation, VerifyResult, Chunk, LawArticle 등 |
| `medichecker/verification.ts` | `verify` | 7단계 파이프라인 오케스트레이터 (SSE 진행 콜백) |
| `medichecker/rag.ts` | `hybridSearch` | pgvector 시맨틱 + pg_trgm 키워드 RRF 결합 |
| `medichecker/ontology.ts` | `enrichContext` | 1홉 관계 탐색, 시술 특화 정보 |
| `medichecker/analysis.ts` | `scanKeywords`, `classifyContent` | 키워드 스캔 + Claude Haiku 분류 |
| `medichecker/claude-client.ts` | `judgeViolation`, `verifySelf` | Claude Sonnet/Haiku API 래퍼 |
| `medichecker/embedding.ts` | `embeddingProvider` | OpenAI text-embedding-3-small |
| `medichecker/highlight.ts` | `findViolationRanges` | 위반 텍스트 위치 4단계 매칭 |
| `medichecker/risk-level.ts` | `getRiskLevel` | 위험도 점수 → 라벨/색상/배지 매핑 (공용) |

## KST 타임존 규칙 (필수)

서버(Vercel)는 UTC, 브라우저는 사용자 로컬 타임존으로 동작한다. **비즈니스 날짜는 항상 KST(Asia/Seoul, UTC+9) 기준**이어야 하므로, 명시적 변환 없이 `Date` 객체나 ISO 문자열의 날짜 부분을 직접 사용하면 하루 밀림 버그가 발생한다.

### 핵심 원칙
> **Date → 날짜 문자열 변환 시 반드시 KST 타임존을 명시적으로 지정한다.**

### 상황별 올바른 패턴

| 상황 | 올바른 패턴 | 금지 패턴 (UTC 기준이라 오류) |
|------|------------|---------------------------|
| Date → YYYY-MM-DD | `getKstDateString(date)` | `date.toISOString().split('T')[0]` |
| Date → YYYY-MM (월) | `getKstDateString(date).slice(0, 7)` | `date.toISOString().slice(0, 7)` |
| DB timestamp → YYYY-MM-DD | `getKstDateString(toUtcDate(str))` | `str.split('T')[0]` |
| 쿼리 파라미터 → KST 날짜 | `getKstDateString(new Date(param))` | `param.split('T')[0]` |
| YYYY-MM-DD → Date 생성 | `new Date(dateStr + 'T00:00:00+09:00')` | `new Date(dateStr + 'T00:00:00')` |
| Date → 표시용 문자열 | `date.toLocaleDateString('ko', { timeZone: 'Asia/Seoul' })` | `date.toLocaleDateString('ko')` |
| DB 쿼리용 KST 하루 범위 | `getKstDayStartISO(date)` ~ `getKstDayEndISO(date)` | 수동 ISO 문자열 조합 |
| stat_date(DATE 컬럼) 키 추출 | `row.stat_date.slice(0, 10)` (이미 YYYY-MM-DD) | `row.stat_date.split('T')[0]` |

### 왜 위험한가 — 실제 사례

```
KST 2026-03-30 00:00:00 = UTC 2026-03-29T15:00:00.000Z

// 잘못된 코드: UTC 날짜 부분 추출
new Date('2026-03-30T00:00:00+09:00').toISOString().split('T')[0]
// → "2026-03-29" ← 하루 전!

// 올바른 코드: KST 기준 추출
getKstDateString(new Date('2026-03-30T00:00:00+09:00'))
// → "2026-03-30" ✓
```

### `lib/date.ts` 함수 요약

| 함수 | 반환 | 용도 |
|------|------|------|
| `toUtcDate(str)` | `Date` | 타임존 없는 DB 문자열 → UTC Date 변환 |
| `formatDate(str\|Date)` | `"2026. 3. 30."` | 표시용 날짜 (KST) |
| `formatDateTime(str\|Date)` | `"3월 30일 14:30"` | 표시용 날짜+시간 (KST) |
| `formatTime(str\|Date)` | `"14:30"` | 표시용 시간 (KST) |
| `getKstDateString(date?)` | `"2026-03-30"` | YYYY-MM-DD (KST). 쿼리·키·비교용 |
| `getKstDayStartISO(date?)` | `"2026-03-29T15:00:00.000Z"` | KST 00:00:00의 UTC ISO. DB 범위 쿼리 시작 |
| `getKstDayEndISO(date?)` | `"2026-03-30T14:59:59.999Z"` | KST 23:59:59의 UTC ISO. DB 범위 쿼리 끝 |

### 코드 리뷰 체크리스트 (날짜 관련 변경 시)
- [ ] `split('T')[0]`, `.toISOString()` 후 문자열 가공이 없는가?
- [ ] `new Date(str)` 생성 시 타임존이 명시되어 있는가?
- [ ] `toLocaleDateString()`에 `{ timeZone: 'Asia/Seoul' }` 가 포함되어 있는가?
- [ ] API 쿼리 파라미터 날짜를 `getKstDateString(new Date(param))`으로 변환하는가?
- [ ] `Date.now()` 산술 결과를 직접 날짜 문자열로 쓰지 않고 `getKstDateString()`을 거치는가?
