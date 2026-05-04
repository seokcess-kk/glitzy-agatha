-- ============================================================
-- Agatha — ad_stats.campaign_name 컬럼 추가
-- ============================================================
-- 배경:
--   metaAds / naverAds 등이 ad_stats 에 campaign_name 을 upsert 하는데
--   초기 스키마에 해당 컬럼이 없어 PGRST204 (Could not find the
--   'campaign_name' column of 'ad_stats') 에러로 광고 레벨 동기화가 실패.
--
-- 적용:
--   Supabase 대시보드 → SQL Editor 에서 실행 (또는 supabase db push)
-- ============================================================

ALTER TABLE public.ad_stats
  ADD COLUMN IF NOT EXISTS campaign_name VARCHAR(200);
