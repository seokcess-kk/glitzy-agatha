-- ============================================================
-- Agatha — landing_pages 누락 컬럼 보강
-- ============================================================
-- 배경:
--   API/UI 코드가 name / file_name / original_file_name / description
--   을 사용하지만 초기 스키마(00000000_agatha_initial.sql)는 title /
--   original_filename 만 있어 PostgREST 가
--   "column landing_pages_1.name does not exist" 반환.
--
--   idempotent — ADD COLUMN IF NOT EXISTS + 기존 title/original_filename
--   데이터 backfill (NULL 인 경우만).
--
-- 적용:
--   Supabase 대시보드 SQL Editor 에서 전체 실행.
-- ============================================================

-- 1) 누락 컬럼 보강
ALTER TABLE public.landing_pages
  ADD COLUMN IF NOT EXISTS name               VARCHAR(200),
  ADD COLUMN IF NOT EXISTS file_name          VARCHAR(200),
  ADD COLUMN IF NOT EXISTS original_file_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS description        TEXT;

-- 2) 기존 데이터 backfill (운영 DB 에 title/original_filename 만 있는 경우)
--    NULL 인 row 만 갱신해 idempotent 유지.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'landing_pages' AND column_name = 'title'
  ) THEN
    UPDATE public.landing_pages
       SET name = title
     WHERE name IS NULL AND title IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'landing_pages' AND column_name = 'original_filename'
  ) THEN
    UPDATE public.landing_pages
       SET original_file_name = original_filename
     WHERE original_file_name IS NULL AND original_filename IS NOT NULL;
  END IF;
END $$;

-- 3) PostgREST 스키마 캐시 강제 리로드
NOTIFY pgrst, 'reload schema';
