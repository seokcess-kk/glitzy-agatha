-- ============================================================
-- Agatha — client_api_configs 스키마를 코드와 일치시키기
-- ============================================================
-- 배경:
--   00000000_agatha_initial.sql 가 정의한 client_api_configs 는
--   `config_data` 컬럼만 가지고 있었으나, 실제 코드(API/서비스 5개 파일)는
--   `config` 컬럼과 `last_tested_at`, `last_test_result`, `updated_at` 을
--   사용해 왔다. 결과적으로 광고 매체 API 키 저장/조회/연결 테스트가
--   500 에러로 실패하는 상태였다.
--
-- 조치:
--   1) config_data → config 컬럼 RENAME (기존 데이터 보존)
--   2) last_tested_at / last_test_result / updated_at 누락 컬럼 추가
--
-- 적용 방법:
--   Supabase 대시보드 → SQL Editor 에서 본 파일 전체 실행
--   또는 supabase CLI: supabase db push
-- ============================================================

-- 1) 컬럼명 정정: config_data → config (이미 정정됐으면 skip)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'client_api_configs'
      AND column_name = 'config_data'
  )
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'client_api_configs'
      AND column_name = 'config'
  ) THEN
    ALTER TABLE public.client_api_configs RENAME COLUMN config_data TO config;
  END IF;
END $$;

-- 2) 누락 컬럼 추가 (이미 있으면 skip)
ALTER TABLE public.client_api_configs
  ADD COLUMN IF NOT EXISTS last_tested_at TIMESTAMPTZ;

ALTER TABLE public.client_api_configs
  ADD COLUMN IF NOT EXISTS last_test_result VARCHAR(20);

ALTER TABLE public.client_api_configs
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 검증 쿼리 (선택):
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'client_api_configs'
-- ORDER BY ordinal_position;
