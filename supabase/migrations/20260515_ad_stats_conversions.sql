-- ============================================================
-- Agatha — ad_stats 에 conversions 컬럼 추가
-- ============================================================
-- 배경:
--   소재별 성과 화면(creatives-performance) 에 매체 전환을 표시하려면
--   utm_content 단위 conversions 가 필요하다. 캠페인 단위
--   ad_campaign_stats.conversions 는 어떤 소재에서 전환났는지 모름.
--
--   Meta Insights API 는 ad-level 에서 actions[] 를 보고하므로
--   ad_stats 에 conversions 컬럼을 추가하면 ad_id → utm_content
--   매핑으로 소재별 매체 전환을 떨어뜨릴 수 있다.
--
-- 적용:
--   Supabase 대시보드 SQL Editor 에서 본 파일 실행
--   (idempotent — ADD COLUMN IF NOT EXISTS)
-- ============================================================

ALTER TABLE public.ad_stats
  ADD COLUMN IF NOT EXISTS conversions INTEGER DEFAULT 0;

-- 기존 row 의 NULL → 0 보정 (DEFAULT 만 설정 시 기존 row 는 NULL 가능)
UPDATE public.ad_stats SET conversions = 0 WHERE conversions IS NULL;
