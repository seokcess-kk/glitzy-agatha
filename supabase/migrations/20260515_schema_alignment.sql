-- ============================================================
-- Agatha — 운영 DB ↔ 코드 정합성 보강 (누락 컬럼 일괄 추가)
-- ============================================================
-- 배경:
--   운영 DB 의 information_schema.columns 점검 결과 다음 누락 확인.
--   삭제/타입변경 일절 없음. ADD COLUMN IF NOT EXISTS + FK 제약은
--   pg_constraint 체크 후 추가하는 idempotent 방식.
--
-- 정책:
--   - leads.status / sms_send_logs.phone_number / sms_send_logs.detail
--     등 운영 DB 가 보유한 컬럼은 그대로 유지 (코드는 운영 DB 컬럼명으로 통일)
--   - clients.notify_phone / notify_enabled 는 미생성 — 운영 DB 의
--     notify_phones[] 만 사용하도록 코드 폴백 처리됨
--
-- 적용:
--   Supabase 대시보드 SQL Editor 에서 전체 실행.
-- ============================================================

-- 1) leads — webhook / 수동 등록에서 사용
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS custom_data JSONB,
  ADD COLUMN IF NOT EXISTS created_by  INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.leads'::regclass AND conname = 'leads_created_by_fk'
  ) THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_created_by_fk
      FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2) lead_raw_logs — webhook 멱등성 / lead 매핑 추적
ALTER TABLE public.lead_raw_logs
  ADD COLUMN IF NOT EXISTS status       VARCHAR(20),
  ADD COLUMN IF NOT EXISTS lead_id      INTEGER,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.lead_raw_logs'::regclass AND conname = 'lead_raw_logs_lead_fk'
  ) THEN
    ALTER TABLE public.lead_raw_logs
      ADD CONSTRAINT lead_raw_logs_lead_fk
      FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3) sms_send_logs — 재시도/감사 컬럼
ALTER TABLE public.sms_send_logs
  ADD COLUMN IF NOT EXISTS attempts      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS sent_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lead_id       INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sms_send_logs'::regclass AND conname = 'sms_send_logs_lead_fk'
  ) THEN
    ALTER TABLE public.sms_send_logs
      ADD CONSTRAINT sms_send_logs_lead_fk
      FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4) capi_events — Meta CAPI 감사/분석 컬럼
ALTER TABLE public.capi_events
  ADD COLUMN IF NOT EXISTS pixel_id          TEXT,
  ADD COLUMN IF NOT EXISTS user_phone_hash   TEXT,
  ADD COLUMN IF NOT EXISTS user_email_hash   TEXT,
  ADD COLUMN IF NOT EXISTS user_fn_hash      TEXT,
  ADD COLUMN IF NOT EXISTS event_source_url  TEXT,
  ADD COLUMN IF NOT EXISTS meta_response     JSONB,
  ADD COLUMN IF NOT EXISTS error_message     TEXT;

-- 5) PostgREST 스키마 캐시 즉시 reload
NOTIFY pgrst, 'reload schema';
