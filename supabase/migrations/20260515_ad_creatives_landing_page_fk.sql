-- ============================================================
-- Agatha — ad_creatives 에 landing_page_id 컬럼 + FK + 부속 컬럼 보강
-- ============================================================
-- 배경:
--   소재 등록 시 PostgREST 가 "Could not find a relationship between
--   'ad_creatives' and 'landing_pages' in the schema cache" 에러 반환.
--   ad-creatives 페이지/API 가 landing_page_id 와 부속 UTM/파일 컬럼을
--   사용하는데 초기 스키마(00000000_agatha_initial.sql) 에는 누락.
--
--   idempotent — ADD COLUMN IF NOT EXISTS 와 DO $$ ... pg_constraint
--   체크로 재실행 안전.
--
-- 적용:
--   Supabase 대시보드 SQL Editor 에서 본 파일 전체 실행.
-- ============================================================

-- 1) 누락 컬럼 보강 (idempotent)
ALTER TABLE public.ad_creatives
  ADD COLUMN IF NOT EXISTS landing_page_id INTEGER,
  ADD COLUMN IF NOT EXISTS description     TEXT,
  ADD COLUMN IF NOT EXISTS utm_source      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS utm_medium      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS utm_campaign    VARCHAR(100),
  ADD COLUMN IF NOT EXISTS utm_term        VARCHAR(100),
  ADD COLUMN IF NOT EXISTS file_name       VARCHAR(200),
  ADD COLUMN IF NOT EXISTS file_type       VARCHAR(50),
  ADD COLUMN IF NOT EXISTS is_active       BOOLEAN DEFAULT TRUE;

-- 2) ad_creatives.landing_page_id → landing_pages.id FK (PostgREST 관계 인식용)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ad_creatives'::regclass
      AND conname  = 'ad_creatives_landing_page_fk'
  ) THEN
    ALTER TABLE public.ad_creatives
      ADD CONSTRAINT ad_creatives_landing_page_fk
      FOREIGN KEY (landing_page_id)
      REFERENCES public.landing_pages(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 3) ad_creatives.client_id → clients.id FK 가 PostgREST 관계용으로 보장 (이미 있음)
--    명시적 join (client:clients(*)) 이 동작하려면 FK 가 있어야 한다.
--    초기 스키마에는 INLINE REFERENCES 로 잡혀있지만 명시 제약명이 없을 수 있어 보강.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ad_creatives'::regclass
      AND conname  = 'ad_creatives_client_fk'
  ) THEN
    -- 기존 inline FK 가 다른 이름으로 존재하면 그것으로 충분. 없으면 추가.
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.ad_creatives'::regclass
        AND contype  = 'f'
        AND pg_get_constraintdef(oid) LIKE '%REFERENCES clients%'
    ) THEN
      ALTER TABLE public.ad_creatives
        ADD CONSTRAINT ad_creatives_client_fk
        FOREIGN KEY (client_id)
        REFERENCES public.clients(id);
    END IF;
  END IF;
END $$;

-- 4) PostgREST 스키마 캐시 강제 리로드
NOTIFY pgrst, 'reload schema';
