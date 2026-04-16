# lib/ 핵심 유틸리티 규칙

## 인증 흐름 (lib/auth.ts)

```
사용자 → NextAuth Credentials → authorize()
  ├─ Rate Limit: IP:phone_number 키, 15분/5회 (lib/rate-limit.ts)
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
- 광고: `GOOGLE_ADS_*`, `META_*`, `TIKTOK_*` (+ 클라이언트별 `client_api_configs`)
- SMS: `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SOLAPI_SENDER_NUMBER`
- 메시징: `QSTASH_*`
- 에러 알림: `ADMIN_ALERT_PHONES` (프로덕션 에러 SMS 수신 번호)

## DB 핵심 테이블

| 테이블 | 용도 | 비고 |
|--------|------|------|
| `clients` | 클라이언트 고객사 | `notify_phones TEXT[]` 최대 3개, `erp_client_id TEXT` (glitzy-web UUID) |
| `users` | 로그인 계정 | role: superadmin/agency_staff/client_admin/client_staff |
| `contacts` | 고객 (CDP) | `phone_number`로 식별 |
| `leads` | 리드/문의 | UTM, `landing_page_id`, `updated_by` |
| `ad_campaign_stats` | 캠페인 레벨 광고 통계 | 일별 집계 |
| `ad_stats` | 광고(ad) 레벨 성과 | Meta: utm_content 매핑, TikTok: ad_id 기준 |
| `client_api_configs` | 클라이언트별 광고 API 키 | |
| `landing_pages` | 랜딩 페이지 | 8자리 랜덤 ID |
| `lead_raw_logs` | 리드 원본 로그 | 멱등성 키로 유실 방지 |
| `sms_send_logs` | SMS 발송 로그 | status: sent/retrying/failed |
| `activity_logs` | 활동 이력 | 누가 무엇을 변경했는지 |
| `user_client_assignments` | agency_staff 클라이언트 배정 | |
| `user_menu_permissions` | agency_staff 메뉴 권한 | |
| `monitoring_keywords` | 순위 모니터링 키워드 | place/website/smartblock/related |
| `monitoring_rankings` | 일별 순위 데이터 | keyword_id + rank_date UNIQUE |
| `login_logs` | 로그인 시도 이력 | IP, success, failure_reason |
| `deleted_records` | 삭제 데이터 스냅샷 보관 | 감사/복구용 |
| `capi_events` | Meta CAPI 전송 로그 | status: pending/success/fail |
| `oauth_states` | OAuth CSRF state 임시 저장 | 10분 만료, 일회용 |
| `invitations` | 초대 링크 (토큰 기반 회원가입) | token UNIQUE, status: pending/completed/expired/cancelled |
| `budget_history` | 예산 변경 이력 | client_id, 변경일, 변경 금액, 사유 |
| `client_notify_settings` | 클라이언트별 알림 설정 | 알림 유형별 활성/비활성 |
| `system_settings` | 시스템 전역 설정 (공용) | key(PK) + value(JSONB) |

## SMS 발송 (lib/solapi.ts)

- `sendSmsWithLog()`: 발송 + DB 로그 기록. 실패 시 `logId` 반환
- 실패 시 `/api/qstash/sms-retry`로 자동 재시도 (최대 3회, 3분→5분 간격)
- 클라이언트별 알림 연락처: `clients.notify_phones TEXT[]` 최대 3개

## 유틸리티 모듈 요약

| 모듈 | 핵심 export | 용도 |
|------|------------|------|
| `api-middleware.ts` | `withAuth`, `withClientFilter`, `apiSuccess`, `apiError`, `applyClientFilter`, `applyDateRange` | API 인증/필터 래퍼 + 쿼리 필터 헬퍼 |
| `security.ts` | `parseId`, `sanitizeString`, `sanitizeUrl`, `canModifyBooking` | 입력 검증/권한 체크. URL에는 `sanitizeUrl` 사용 |
| `logger.ts` | `createLogger` | 환경별 로깅 (dev=readable, prod=JSON) |
| `api-client.ts` | `fetchJSON`, `fetchWithRetry` | 외부 API 호출 (재시도+타임아웃) |
| `utm.ts` | `parseUtmFromUrl`, `sanitizeUtmParams`, `mergeUtmParams` | UTM 파싱/검증 |
| `activity-log.ts` | `logActivity` | 활동 이력 기록 (non-blocking) |
| `solapi.ts` | `sendSmsWithLog` | SMS 발송 + 로그 |
| `rate-limit.ts` | Rate Limit | IP:phone_number 기반 제한 |
| `error-alert.ts` | `sendErrorAlert` | 프로덕션 에러 → 관리자 SMS (쿨다운 5분, 일일 50건) |
| `archive.ts` | `archiveBeforeDelete`, `archiveBulkBeforeDelete` | 삭제 전 스냅샷 보관 |
| `platform.ts` | `API_PLATFORMS`, `CREATIVE_PLATFORMS`, `CAMPAIGN_TYPES_BY_PLATFORM`, `isApiPlatform` 등 | 광고 플랫폼 & 캠페인 타입 중앙 상수 |
| `channel.ts` | `normalizeChannel` | utm_source/platform → canonical 채널명 |
| `channel-colors.ts` | `getChannelColor` | 채널별 Recharts 색상 코드 |
| `chart-colors.ts` | `CHART_PALETTE`, `CHART_SEMANTIC`, `PIE_SHADES`, `BAR_COLORS` 등 | Recharts 차트 컬러 중앙 상수 |
| `date.ts` | `formatDate`, `toUtcDate`, `getKstDateString`, `getKstDayStartISO`, `getKstDayEndISO` | KST 기준 날짜 포맷/생성 |
| `services/metaAds.ts` | `fetchMetaAds`, `fetchMetaAdStats` | Meta 캠페인 + ad 레벨 수집 |
| `services/tiktokAds.ts` | `fetchTikTokAds`, `fetchTikTokAdStats` | TikTok 캠페인 + ad 레벨 수집 |
| `services/metaCapi.ts` | Meta CAPI 전송 | 리드 유입 시 서버사이드 전환 이벤트 전송 |
| `services/erpClient.ts` | `fetchErpClients`, `createErpClient`, `fetchQuotes`, `fetchQuoteDetail`, `fetchInvoices`, `fetchInvoiceDetail`, `respondToQuote` | glitzy-web ERP API 프록시 (거래처/견적서/계산서) |

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
| YYYY-MM-DD → Date 생성 | `new Date(dateStr + 'T00:00:00+09:00')` | `new Date(dateStr + 'T00:00:00')` |
| Date → 표시용 문자열 | `date.toLocaleDateString('ko', { timeZone: 'Asia/Seoul' })` | `date.toLocaleDateString('ko')` |
| DB 쿼리용 KST 하루 범위 | `getKstDayStartISO(date)` ~ `getKstDayEndISO(date)` | 수동 ISO 문자열 조합 |

### 코드 리뷰 체크리스트 (날짜 관련 변경 시)
- [ ] `split('T')[0]`, `.toISOString()` 후 문자열 가공이 없는가?
- [ ] `new Date(str)` 생성 시 타임존이 명시되어 있는가?
- [ ] `toLocaleDateString()`에 `{ timeZone: 'Asia/Seoul' }` 가 포함되어 있는가?
- [ ] API 쿼리 파라미터 날짜를 `getKstDateString(new Date(param))`으로 변환하는가?
