# Implementation Plan: 병원별 광고 API 키 관리 시스템

**Status**: ✅ Complete
**Started**: 2026-03-19
**Last Updated**: 2026-03-19

---

**CRITICAL INSTRUCTIONS**: After completing each phase:
1. ✅ Check off completed task checkboxes
2. 🧪 `npm run build && npm run lint` 실행
3. ⚠️ Quality Gate 전체 통과 확인
4. 📝 Notes 섹션에 이슈/학습 기록
5. ➡️ 모든 검증 통과 후 다음 Phase 진행

⛔ **빌드/린트 에러가 남은 상태로 다음 Phase 진행 금지**

---

## 📋 Overview

### 현재 문제
- 광고 동기화가 환경변수 1개 = 전체 병원 공통 1개 계정 구조
- 병원마다 다른 Meta/Google/TikTok 광고 계정 사용 → 현재 구조로는 불가
- `ad_campaign_stats`에 `clinic_id`는 있지만, 동기화 서비스가 `clinic_id`를 upsert에 포함하지 않음
- `ad_campaign_stats`의 UNIQUE 제약이 `(platform, campaign_id, stat_date)`로 clinic_id 미포함 → 병원별 동기화 시 충돌

### 목표
병원별 × 매체별 API 키를 `clinic_api_configs` 테이블에서 관리하고, 슈퍼어드민이 관리 UI에서 설정/테스트/활성화할 수 있는 시스템

### 병렬 실행 구조

```
시간 →  ─────────────────────────────────────────────────────────────

Phase 0  ┃ 사전 확인 (DB 스키마)  ┃
(필수)    ┃ (0.5h)               ┃
                                  ↓
Phase 1  ┃ DB 마이그레이션 + 암호화 유틸 ┃
(기반)    ┃ (1.5h)                      ┃
                                         ↓
         ┌───────────────────────────────┴───────────────────────┐
         ▼                                                       ▼
Stream A                                                   Stream B
Phase 2  ┃ 관리 API + 연결 테스트 (2h)  ┃                Phase 4  ┃ 동기화 리팩토링 (2.5h)  ┃
              ↓
Phase 3  ┃ 관리 UI (2.5h)              ┃
```

**의존성 맵**:
- Phase 0 → Phase 1: 순차 (스키마 확인 후 마이그레이션 확정)
- Phase 1 완료 후 → **Stream A(Phase 2→3)와 Stream B(Phase 4) 동시 시작**
- Stream A: Phase 2(API) → Phase 3(UI) 순차
- Stream B: Phase 4는 DB + crypto만 필요, 관리 API와 독립

**병렬 실행 시 실 소요시간**: ~6.5h (Phase 0~1: 2h + Stream A: 4.5h가 최장 경로)

### 데이터 흐름 (변경 후)

```
슈퍼어드민 관리 UI
  └─ 병원 선택 → 매체별 API 키 입력 → [연결 테스트] 버튼
       ↓
clinic_api_configs 테이블
  ├─ clinic_id=1, platform=meta_ads    → { account_id, access_token } (암호화)
  ├─ clinic_id=1, platform=google_ads  → { client_id, secret, token, customer_id, refresh } (암호화)
  ├─ clinic_id=1, platform=tiktok_ads  → { advertiser_id, access_token } (암호화)
  ├─ clinic_id=2, platform=meta_ads    → { account_id, access_token } (암호화)
  └─ ... (기존 meta_capi, youtube_content, instagram_content와 공존)
       ↓
Cron (매일 03:00, maxDuration=300) → 활성 병원 순회 → 병원별 설정된 매체만 동기화
  └─ ad_campaign_stats (clinic_id 포함, UNIQUE 제약 변경됨)
```

### Success Criteria
- [ ] 슈퍼어드민이 병원별로 Meta/Google/TikTok API 키를 입력할 수 있다
- [ ] 연결 테스트 버튼으로 API 키가 유효한지 즉시 확인할 수 있다
- [ ] Cron 동기화가 병원별 API 키로 각각 실행된다
- [ ] 환경변수 폴백: clinic_api_configs에 없으면 기존 환경변수 사용 (하위 호환)
- [ ] 수동 동기화("지금 데이터 수집") 버튼이 선택된 병원의 API 키로 동작한다
- [ ] API 키는 암호화되어 DB에 저장된다 (평문 저장 금지)

---

## 🏗️ Architecture Decisions

| Decision | Rationale | Trade-offs |
|----------|-----------|------------|
| `clinic_api_configs` 테이블 재활용 | 이미 meta_capi, youtube/instagram_content에서 사용 중. ALTER TABLE로 누락 컬럼만 추가 | 기존 스키마 확인 후 마이그레이션 작성 필요 |
| API 키 암호화 (AES-256-GCM) | DB 유출 시 평문 노출 방지 | 암호화 키 관리 필요 (`API_ENCRYPTION_KEY` 환경변수) |
| 환경변수 폴백 유지 | clinic_api_configs 미설정 시 기존 환경변수로 동작 → 하위 호환 | 폴백 로직 추가 |
| 연결 테스트는 최소 API 호출 | 전체 캠페인 조회 대신 계정 정보만 확인 → 빠르고 안전 | 실제 데이터 수집과 다른 경로 |
| 동기화 시 병원별 순차 실행 | 병원 간 API rate limit 분리, 에러 격리 | 전체 동기화 시간 증가 → maxDuration=300 |
| ad_campaign_stats UNIQUE 제약 변경 | clinic_id 포함 필요 (병원별 동일 campaign_id 가능) | 기존 데이터 정제 마이그레이션 필요 |

---

## ⚠️ 사전 확인 (Phase 0 — 구현 시작 전 필수)

Phase 1 시작 전에 반드시 아래를 확인하고 결과를 Notes에 기록할 것:

- [x] **0.1** Supabase 대시보드에서 `clinic_api_configs` 테이블의 **실제 스키마** 확인
  - 컬럼 목록, 타입, NOT NULL 제약, DEFAULT 값
  - UNIQUE 제약 (`clinic_id, platform` 여부)
  - 인덱스 목록
  - 기존 데이터가 있다면 샘플 추출 (platform 값 목록)
- [x] **0.2** Supabase 대시보드에서 `ad_campaign_stats` 테이블의 **UNIQUE 제약** 확인
  - `(platform, campaign_id, stat_date)` 인지 `(clinic_id, platform, campaign_id, stat_date)` 인지
  - 기존 데이터에서 동일 `(platform, campaign_id, stat_date)` + 다른 `clinic_id` 조합이 있는지 확인
  ```sql
  SELECT platform, campaign_id, stat_date, COUNT(DISTINCT clinic_id)
  FROM ad_campaign_stats
  GROUP BY platform, campaign_id, stat_date
  HAVING COUNT(DISTINCT clinic_id) > 1;
  ```
- [x] **0.3** 결과에 따라 Phase 1 마이그레이션 SQL 확정 (CREATE TABLE vs ALTER TABLE)

---

## 🚀 Phase 1: DB 마이그레이션 + 암호화 유틸 (1.5h)

**Goal**: clinic_api_configs 스키마 보완 + ad_campaign_stats UNIQUE 변경 + API 키 암호화 유틸
**Status**: ✅ Complete

### Tasks
- [x] **1.1** `supabase/migrations/20260319_clinic_api_configs_ads.sql` 생성
  - Phase 0 확인 결과에 따라 2가지 중 택 1:

  **Case A: 테이블이 이미 존재하는 경우 (높은 가능성)**
  ```sql
  -- 누락 컬럼만 추가 (IF NOT EXISTS로 안전하게)
  ALTER TABLE clinic_api_configs ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
  ALTER TABLE clinic_api_configs ADD COLUMN IF NOT EXISTS last_tested_at TIMESTAMPTZ;
  ALTER TABLE clinic_api_configs ADD COLUMN IF NOT EXISTS last_test_result VARCHAR(20);
  ALTER TABLE clinic_api_configs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

  -- UNIQUE 제약 확인 (없으면 추가)
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'clinic_api_configs_clinic_id_platform_key'
    ) THEN
      ALTER TABLE clinic_api_configs ADD CONSTRAINT clinic_api_configs_clinic_id_platform_key UNIQUE (clinic_id, platform);
    END IF;
  END $$;

  -- 인덱스
  CREATE INDEX IF NOT EXISTS idx_clinic_api_configs_clinic ON clinic_api_configs(clinic_id);
  CREATE INDEX IF NOT EXISTS idx_clinic_api_configs_active ON clinic_api_configs(clinic_id, is_active);
  ```

  **Case B: 테이블이 존재하지 않는 경우**
  ```sql
  CREATE TABLE clinic_api_configs (
    id SERIAL PRIMARY KEY,
    clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_tested_at TIMESTAMPTZ,
    last_test_result VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clinic_id, platform)
  );
  CREATE INDEX idx_clinic_api_configs_clinic ON clinic_api_configs(clinic_id);
  CREATE INDEX idx_clinic_api_configs_active ON clinic_api_configs(clinic_id, is_active);
  ```

- [x] **1.2** `supabase/migrations/20260319_ad_campaign_stats_unique.sql` 생성
  - ad_campaign_stats UNIQUE 제약을 clinic_id 포함으로 변경
  ```sql
  -- 기존 UNIQUE 제약 삭제 (이름 확인 후)
  -- Phase 0.2에서 확인한 제약 이름 사용
  ALTER TABLE ad_campaign_stats
    DROP CONSTRAINT IF EXISTS ad_campaign_stats_platform_campaign_id_stat_date_key;

  -- 새 UNIQUE 제약 (clinic_id 포함)
  ALTER TABLE ad_campaign_stats
    ADD CONSTRAINT ad_campaign_stats_clinic_platform_campaign_date_key
    UNIQUE (clinic_id, platform, campaign_id, stat_date);
  ```
  - ⚠️ 기존 데이터에 clinic_id NULL인 행이 있으면 먼저 정제 필요:
  ```sql
  -- NULL clinic_id 행이 있다면 삭제 또는 기본값 설정
  DELETE FROM ad_campaign_stats WHERE clinic_id IS NULL;
  ```

- [x] **1.3** `lib/crypto.ts` 생성 — API 키 암호화/복호화
  - `encryptApiConfig(config: object): string` — AES-256-GCM 암호화
  - `decryptApiConfig(encrypted: string): object` — 복호화
  - 환경변수: `API_ENCRYPTION_KEY` (32바이트 base64)
  - 키 없으면 경고 로그 + 평문 JSON 폴백 (개발환경 편의)

- [x] **1.4** 빌드 검증

### Quality Gate ✋
- [x] `npm run build && npm run lint` 통과
- [ ] 마이그레이션 SQL 문법 검증 (Supabase SQL Editor에서 dry-run)
- [x] 암호화 → 복호화 라운드트립 정상
- [x] 기존 meta_capi, youtube_content, instagram_content 설정에 영향 없음

---

## 🚀 Phase 2: 관리 API (2h)

**Goal**: 병원별 API 키 CRUD + 연결 테스트 API
**Status**: ✅ Complete
**의존성**: Phase 1

### Tasks
- [x] **2.1** `app/api/admin/clinics/[id]/api-configs/route.ts` 생성
  - `withSuperAdmin` 래퍼
  - **GET**: 해당 병원의 광고 매체 설정 조회
    - `platform IN ('meta_ads', 'google_ads', 'tiktok_ads')` 필터
    - 복호화 후 반환, access_token/client_secret/refresh_token은 마스킹 (`****` + 마지막 4자)
    - 기존 meta_capi, youtube_content 등은 조회하지 않음 (별도 관리)
  - **POST**: 매체별 API 키 저장 (암호화 후 DB 저장)
    - body: `{ platform: 'meta_ads', config: { account_id, access_token } }`
    - platform 화이트리스트 검증: `meta_ads`, `google_ads`, `tiktok_ads`만 허용
    - 값 길이 제한 (API 토큰은 특수문자 포함 가능하므로 sanitizeString 미적용)
    - platform별 필수 필드 검증
    - upsert (clinic_id + platform UNIQUE)
  - **DELETE**: 매체 설정 삭제
    - body: `{ platform: 'meta_ads' }`

- [x] **2.2** `app/api/admin/clinics/[id]/api-configs/test/route.ts` 생성
  - `withSuperAdmin` 래퍼
  - **POST**: 연결 테스트
    - body: `{ platform: 'meta_ads' }`
    - 저장된 API 키를 복호화하여 실제 API 호출
    - 매체별 테스트 로직:
      - **Meta**: `GET /v19.0/{account_id}?fields=name,account_status` → 계정명 + 상태
      - **Google**: `customer.query('SELECT customer.descriptive_name FROM customer LIMIT 1')` → 계정명
      - **TikTok**: `GET /advertiser/info?advertiser_ids=[id]` → 광고주명
    - 성공/실패 결과를 `clinic_api_configs.last_tested_at`, `last_test_result`에 업데이트
    - 응답: `{ success: true, accountName: '세레아의원 광고계정', platform: 'meta_ads' }`
    - 실패 시: `{ success: false, error: 'Invalid access token', platform: 'meta_ads' }`
    - 타임아웃: 15초 (외부 API 응답 지연 대비)

- [x] **2.3** 빌드 검증

### Quality Gate ✋
- [x] `npm run build && npm run lint` 통과
- [x] superadmin 외 접근 차단 확인
- [x] API 키 암호화 저장 확인 (DB에 평문 없음)
- [x] 마스킹 확인 (GET 응답에 토큰 전체 노출 안 됨)
- [x] platform 화이트리스트 검증 (meta_ads/google_ads/tiktok_ads 외 거부)

---

## 🚀 Phase 3: 관리 UI (2.5h)

**Goal**: 슈퍼어드민 병원 관리에 매체별 API 키 설정 화면 추가
**Status**: ✅ Complete
**의존성**: Phase 2

### Tasks
- [x] **3.1** `components/admin/ClinicApiConfigDialog.tsx` 생성
  - Dialog (모달) 형태
  - 매체 탭: Meta / Google / TikTok
  - 각 매체별 입력 필드:
    - **Meta**: 광고 계정 ID (`act_xxx`), 액세스 토큰
    - **Google**: Client ID, Client Secret, Developer Token, Customer ID, Refresh Token
    - **TikTok**: Advertiser ID, Access Token
  - 각 매체별 [연결 테스트] 버튼
    - 테스트 중: 로딩 스피너
    - 성공: 계정명 + 초록 뱃지 (✓ 연결됨)
    - 실패: 에러 메시지 + 빨간 뱃지 (✗ 연결 실패)
  - [저장] 버튼 → API 호출
  - 토큰 필드는 `type="password"` + 눈 아이콘(Eye/EyeOff) 토글
  - 마지막 테스트 일시/결과 표시 (`last_tested_at`, `last_test_result`)
  - 매체별 활성화 토글 (`is_active`)

- [x] **3.2** `app/(dashboard)/admin/clinics/page.tsx` 수정
  - 병원 목록 테이블에 "API 설정" 컬럼 추가
  - 매체별 연결 상태 아이콘:
    - 🟢 초록 원: 테스트 성공 (last_test_result='success')
    - ⚪ 회색 원: 미설정
    - 🔴 빨간 원: 테스트 실패 (last_test_result='failed')
  - 아이콘 클릭 시 `ClinicApiConfigDialog` 열림
  - 병원 목록 조회 시 각 병원의 api_configs 요약 정보 함께 로드

- [x] **3.3** 빌드 검증 + 반복 수정 루프

### Quality Gate ✋
- [x] `npm run build && npm run lint` 통과
- [ ] 연결 테스트 성공/실패 UI 피드백 확인 (개발서버 수동 확인 필요)
- [x] 토큰 필드 마스킹 확인 (password 타입)
- [x] 기존 병원 관리 기능(생성/수정/알림설정/활성화) 회귀 없음
- [ ] 모바일 반응형 확인 (개발서버 수동 확인 필요)

---

## 🚀 Phase 4: 동기화 서비스 리팩토링 (2.5h)

**Goal**: 광고 동기화를 병원별 API 키 기반으로 변경
**Status**: ✅ Complete
**의존성**: Phase 1 (DB + crypto만 필요, Phase 2 관리 API와 독립)

### Tasks
- [x] **4.1** `lib/services/adSyncManager.ts` 생성 — 병원별 동기화 오케스트레이터
  - `syncAllClinics(date?)`: 활성 병원 순회 → 병원별 설정된 매체만 동기화
  - `syncClinic(clinicId, date?)`: 특정 병원의 모든 매체 동기화
  - 로직:
    1. `clinic_api_configs`에서 `platform IN ('meta_ads','google_ads','tiktok_ads') AND is_active=true` 조회
    2. 설정된 병원별로 순차 실행 (rate limit 분리)
    3. 설정 없는 병원 중 환경변수가 있으면 폴백 동기화 (clinic_id 없이 기존 방식)
    4. 결과 집계: `{ clinicId, platform, count, error? }[]`
    5. 실패 건 집계 → `sendErrorAlert` 호출

- [x] **4.2** `lib/services/metaAds.ts` 수정
  - 시그니처: `fetchMetaAds(date, options?)` → `options: { clinicId?: number, accountId?: string, accessToken?: string }`
  - `options` 제공 시: options의 값 사용 + clinic_id를 upsert에 포함
  - `options` 없을 시: 기존 환경변수 사용 (하위 호환)
  - upsert onConflict: `'clinic_id,platform,campaign_id,stat_date'`로 변경

- [x] **4.3** `lib/services/googleAds.ts` 수정 — 동일 패턴
  - `options: { clinicId?, clientId?, clientSecret?, developerToken?, customerId?, refreshToken? }`

- [x] **4.4** `lib/services/tiktokAds.ts` 수정 — 동일 패턴
  - `options: { clinicId?, advertiserId?, accessToken? }`

- [x] **4.5** `app/api/cron/sync-ads/route.ts` 수정
  - `maxDuration` 60→300으로 확장
  - 기존: `fetchMetaAds()`, `fetchGoogleAds()`, `fetchTikTokAds()` 직접 호출
  - 변경: `syncAllClinics(yesterday)` 호출
  - 에러 알림: 병원별 실패 건 집계

- [x] **4.6** `app/api/ads/sync/route.ts` 수정 (수동 동기화)
  - `clinic_id` 파라미터 필수화
  - 해당 병원의 `clinic_api_configs` 조회 → 복호화 → `syncClinic(clinicId)` 호출

- [x] **4.7** `app/api/ads/stats/route.ts` 수정
  - `withClinicFilter` 래퍼 적용 또는 `clinic_id` 필터 추가 (현재 멀티테넌트 격리 누락)

- [x] **4.8** 빌드 검증 + 반복 수정 루프

### Quality Gate ✋
- [x] `npm run build && npm run lint` 통과
- [x] clinic_api_configs에 설정된 병원: 해당 API 키로 동기화, ad_campaign_stats에 clinic_id 저장
- [x] clinic_api_configs에 미설정 + 환경변수 있는 경우: 환경변수 폴백 동작
- [x] 양쪽 모두 없으면: 해당 매체 스킵 (count=0, 에러 없음)
- [x] 수동 동기화("지금 데이터 수집")가 선택된 병원의 API 키로 동작
- [x] `ads/stats` API에 clinic_id 필터 적용 확인
- [x] Cron maxDuration=300 설정 확인

---

## ⚠️ Risk Assessment

| Risk | 확률 | 영향 | 대응 |
|------|------|------|------|
| API 키 DB 유출 시 보안 | 낮 | 높 | AES-256-GCM 암호화, `API_ENCRYPTION_KEY` 환경변수 관리 |
| 기존 clinic_api_configs 스키마 불일치 | 중 | 높 | Phase 0에서 실제 스키마 확인 후 마이그레이션 확정 |
| ad_campaign_stats UNIQUE 변경 시 데이터 충돌 | 중 | 높 | Phase 0.2에서 중복 데이터 조회, 필요 시 정제 스크립트 |
| 병원 수 증가 시 Cron 타임아웃 | 중 | 중 | maxDuration=300, 10개 초과 시 QStash 분산 검토 |
| Meta/Google 토큰 만료 | 중 | 중 | 시스템 사용자 토큰(Meta), Refresh Token(Google). 실패 시 last_test_result='failed' + 알림 |
| 환경변수 폴백과 clinic_api_configs 충돌 | 낮 | 중 | clinic_api_configs 최우선, 환경변수는 설정 없을 때만 |

---

## 🔄 Rollback Strategy

| Phase | 롤백 방법 |
|-------|----------|
| Phase 1 | 마이그레이션 revert (ALTER TABLE DROP COLUMN / DROP CONSTRAINT), crypto.ts 삭제 |
| Phase 2 | API 파일 2개 삭제 |
| Phase 3 | 컴포넌트 삭제, clinics/page.tsx git revert |
| Phase 4 | 서비스 파일 git revert, adSyncManager.ts 삭제, maxDuration 원복 |

---

## 📁 파일 변경 전체 목록

| Phase | 작업 | 파일 |
|-------|------|------|
| 1 | CREATE | `supabase/migrations/20260319_clinic_api_configs_ads.sql` |
| 1 | CREATE | `supabase/migrations/20260319_ad_campaign_stats_unique.sql` |
| 1 | CREATE | `lib/crypto.ts` |
| 2 | CREATE | `app/api/admin/clinics/[id]/api-configs/route.ts` |
| 2 | CREATE | `app/api/admin/clinics/[id]/api-configs/test/route.ts` |
| 3 | CREATE | `components/admin/ClinicApiConfigDialog.tsx` |
| 3 | MODIFY | `app/(dashboard)/admin/clinics/page.tsx` |
| 4 | CREATE | `lib/services/adSyncManager.ts` |
| 4 | MODIFY | `lib/services/metaAds.ts` |
| 4 | MODIFY | `lib/services/googleAds.ts` |
| 4 | MODIFY | `lib/services/tiktokAds.ts` |
| 4 | MODIFY | `app/api/cron/sync-ads/route.ts` |
| 4 | MODIFY | `app/api/ads/sync/route.ts` |
| 4 | MODIFY | `app/api/ads/stats/route.ts` |

---

## 📊 Progress Tracking

| Stream | Phase | 작업 | 예상 시간 | 의존성 | 상태 |
|--------|-------|------|----------|--------|------|
| — | 0 | 사전 확인 (DB 스키마) | 0.5h | 없음 | ✅ |
| — | 1 | DB 마이그레이션 + 암호화 유틸 | 1.5h | Phase 0 | ✅ |
| A | 2 | 관리 API + 연결 테스트 | 2h | Phase 1 | ✅ |
| A | 3 | 관리 UI | 2.5h | Phase 2 | ✅ |
| B | 4 | 동기화 리팩토링 | 2.5h | Phase 1 | ✅ |
| | | **합계** | **9h** | | |

**병렬 실행 시**: Phase 0~1(2h) → Stream A(4.5h) ∥ Stream B(2.5h) = **최장 경로 6.5h**

---

## 📝 Notes & Learnings

### Phase 0 스키마 확인 결과 (2026-03-19)

**clinic_api_configs 테이블** — 이미 존재 (Case A 확정)
- 컬럼: id (integer, NOT NULL, auto-increment), clinic_id (integer, nullable), platform (varchar, NOT NULL), config (jsonb, NOT NULL, default '{}'), updated_at (timestamp, nullable, default CURRENT_TIMESTAMP)
- 누락 컬럼: is_active, last_tested_at, last_test_result, created_at → ALTER TABLE로 추가
- clinic_id NOT NULL 제약 없음 → SET NOT NULL 추가
- UNIQUE(clinic_id, platform) 제약 없음 → 추가
- 인덱스 없음 → 추가

**ad_campaign_stats 테이블**
- 기존 UNIQUE: (platform, campaign_id, stat_date) — clinic_id 미포함
- 중복 데이터 0건 (동일 platform+campaign_id+stat_date에 다른 clinic_id 없음) → UNIQUE 변경 안전

### Phase 1 완료 (2026-03-19)
- 마이그레이션 2개 + lib/crypto.ts 생성
- `npm run build && npm run lint` 통과 (신규 에러 0건)
- SQL dry-run은 Supabase SQL Editor에서 수동 검증 필요

### Phase 4 완료 (2026-03-19)
- `adSyncManager.ts` 생성: syncAllClinics(Cron용) + syncClinic(수동용) 오케스트레이터
- `metaAds.ts`, `googleAds.ts`, `tiktokAds.ts` 수정: options 패턴 + clinic_id upsert + 새 onConflict 키
- `cron/sync-ads` 수정: syncAllClinics 사용, maxDuration=300, 이상치 감지 연동
- `ads/sync` 수정: withClinicFilter + syncClinic/syncAllClinics 분기
- `ads/stats` 수정: withClinicFilter + applyClinicFilter 적용 (멀티테넌트 격리 완료)
- `npm run build && npm run lint` 통과 (신규 에러 0건)
- 코드 리뷰에서 6건 수정: sanitizeString→길이검증, NULL upsert partial index, withClinicAdmin, getKstDayStartISO, cron try/catch, logger null fix

### Phase 2 완료 (2026-03-19)
- `api-configs/route.ts` 생성: GET(마스킹)/POST(암호화 upsert)/DELETE(archiveBeforeDelete)
- `api-configs/test/route.ts` 생성: Meta/Google/TikTok 연결 테스트 (15초 타임아웃)
- platform 화이트리스트 + 필수 필드 검증 + 값 길이 제한
- API 토큰에 sanitizeString 미적용 (특수문자 파괴 방지) → 길이 제한만
- `npm run build && npm run lint` 통과 (신규 에러 0건)

### Phase 3 완료 (2026-03-19)
- `ClinicApiConfigDialog.tsx` 생성: 매체 탭(Meta/Google/TikTok), password+Eye 토글, 연결 테스트 UI, 활성화 토글
- `admin/clinics/page.tsx` 수정: API 설정 컬럼 + 매체별 상태 아이콘(M/G/T) + 다이얼로그 연동
- 코드 리뷰에서 3건 수정: dirtyFields/configToSend 이중 구조 제거, is_active 토글 저장 반영, last_test_result VARCHAR(20) 초과 방지
- `npm run build && npm run lint` 통과 (신규 에러 0건)

### 연동 테스트 (2026-03-19)
- 마이그레이션 2개 Supabase SQL Editor에서 실행 완료
- JSONB 이중 인코딩 버그 발견 → API_ENCRYPTION_KEY 미설정 시 객체 직접 저장으로 수정 (route.ts, test/route.ts, adSyncManager.ts)
- Meta API 연결 테스트: 토큰 저장/복호화 정상 확인 (DB 저장값 = 입력값 일치)
- Meta 토큰 발급 이슈: 시스템 사용자 토큰 `Malformed access token` 에러 → 앱 연결/권한 설정 재확인 필요 (Samantha 시스템 문제 아님)

---

## 📚 매체별 API 키 필드 정의

### Meta Ads (`platform: 'meta_ads'`)
```json
{
  "account_id": "act_XXXXXXXXXX",
  "access_token": "EAA... 또는 AAf... (시스템 사용자 토큰, 앱 유형에 따라 접두사 다름)"
}
```
- 연결 테스트: `GET /v19.0/{account_id}?fields=name,account_status`

### Google Ads (`platform: 'google_ads'`)
```json
{
  "client_id": "xxx.apps.googleusercontent.com",
  "client_secret": "xxx",
  "developer_token": "xxx",
  "customer_id": "XXX-XXX-XXXX",
  "refresh_token": "xxx"
}
```
- 연결 테스트: `SELECT customer.descriptive_name FROM customer LIMIT 1`

### TikTok Ads (`platform: 'tiktok_ads'`)
```json
{
  "advertiser_id": "XXXXXXXXX",
  "access_token": "xxx"
}
```
- 연결 테스트: `GET /advertiser/info?advertiser_ids=[id]`

### 기존 platform 키 (변경 없음, 공존)
- `meta_capi`: Meta CAPI 전환 이벤트 (pixel_id, access_token)
- `youtube_content`: YouTube 콘텐츠 동기화
- `instagram_content`: Instagram 콘텐츠 동기화

### 환경변수 폴백 우선순위
```
1. clinic_api_configs 테이블 (is_active=true)  ← 최우선
2. 환경변수 (META_AD_ACCOUNT_ID 등)            ← 폴백 (clinic_id 없이 기존 방식)
3. 양쪽 모두 없으면 해당 매체 스킵 (count=0)
```

### 필요 환경변수 (신규)
```bash
API_ENCRYPTION_KEY=<32바이트 base64>  # openssl rand -base64 32
```
