-- ============================================================
-- Agatha — ad_stats / ad_campaign_stats UNIQUE 제약 보강
-- ============================================================
-- 배경:
--   광고 소재(ad) 동기화는 onConflict 'client_id,platform,ad_id,stat_date' 를
--   사용하지만 초기 스키마에는 해당 UNIQUE 제약이 없어 upsert 시 23505/42P10
--   에러가 날 수 있다. 캠페인 레벨도 마찬가지로 점검.
--
-- 조치:
--   1) ad_stats: (client_id, platform, ad_id, stat_date) UNIQUE
--      + 환경변수 폴백(client_id IS NULL) 용 partial unique
--   2) ad_campaign_stats: 초기 스키마에 UNIQUE(client_id, platform, campaign_id, stat_date)
--      가 이미 정의돼 있으나, 환경변수 폴백용 partial unique 가 누락 → 추가
--
-- 적용:
--   Supabase 대시보드 → SQL Editor 에서 실행 (또는 supabase db push)
-- ============================================================

-- ad_stats: client_id 가 있는 row 용 UNIQUE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ad_stats'::regclass
      AND contype  = 'u'
      AND conname  = 'ad_stats_client_platform_ad_date_key'
  ) THEN
    ALTER TABLE public.ad_stats
      ADD CONSTRAINT ad_stats_client_platform_ad_date_key
      UNIQUE (client_id, platform, ad_id, stat_date);
  END IF;
END $$;

-- ad_stats: 환경변수 폴백 모드(client_id IS NULL) 용 partial unique
CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_stats_fallback_unique
  ON public.ad_stats (platform, ad_id, stat_date)
  WHERE client_id IS NULL;

-- ad_campaign_stats: 환경변수 폴백 모드 partial unique (이미 있을 수 있음)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_campaign_stats_fallback_unique
  ON public.ad_campaign_stats (platform, campaign_id, stat_date)
  WHERE client_id IS NULL;
