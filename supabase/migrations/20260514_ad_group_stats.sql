-- ============================================================
-- Agatha — 광고그룹(adgroup) 단위 통계 테이블 신설
-- ============================================================
-- 배경:
--   네이버 SA 같은 검색광고는 utm_content 기반 소재 매칭이 구조적으로 불가능.
--   대신 광고그룹 단위가 운영 단위로 가장 자연스럽다.
--   "소재별 성과" 화면에 광고그룹 row를 통합 표시하기 위해 신규 테이블 신설.
--
--   1차에는 네이버 SA 만 채움. 향후 Google/TikTok/Kakao 등 동일 패턴으로 확장.
--
-- 컬럼:
--   client_id  — nullable (환경변수 폴백 모드 호환)
--   platform   — 'naver_ads' 등 ApiPlatform
--   campaign_id/name — 캠페인 매칭 키 + 표시명
--   adgroup_id/name  — 광고그룹 식별자 + 표시명
--   stat_date  — 일별 통계
--   metrics    — impressions/clicks/spend/conversions
--
-- 인덱스:
--   1) client_id IS NOT NULL 인 row 용 UNIQUE (client_id, platform, adgroup_id, stat_date)
--      — Supabase upsert(onConflict) 기본 동작
--   2) client_id IS NULL 인 row 용 partial unique
--      — 환경변수 폴백 모드 upsert 충돌 처리
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ad_group_stats (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES public.clients(id),
  platform VARCHAR(20) NOT NULL,
  campaign_id VARCHAR(100),
  campaign_name VARCHAR(200),
  adgroup_id VARCHAR(100) NOT NULL,
  adgroup_name VARCHAR(200),
  stat_date DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  spend_amount DECIMAL(12,2) DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 1) 일반 모드 UNIQUE — client_id 포함
ALTER TABLE public.ad_group_stats
  DROP CONSTRAINT IF EXISTS ad_group_stats_client_platform_adgroup_date_key;
ALTER TABLE public.ad_group_stats
  ADD CONSTRAINT ad_group_stats_client_platform_adgroup_date_key
  UNIQUE (client_id, platform, adgroup_id, stat_date);

-- 2) 환경변수 폴백 모드 partial unique — client_id IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_group_stats_fallback_unique
  ON public.ad_group_stats (platform, adgroup_id, stat_date)
  WHERE client_id IS NULL;

-- 3) 조회 인덱스 — 캠페인 기준 필터 + 날짜 범위
CREATE INDEX IF NOT EXISTS idx_ad_group_stats_client_campaign_date
  ON public.ad_group_stats (client_id, campaign_id, stat_date);

-- 4) RLS 활성화 (다른 테이블과 동일 정책)
ALTER TABLE public.ad_group_stats ENABLE ROW LEVEL SECURITY;
