-- Ad 레벨 일별 성과 테이블
-- Meta/Google/TikTok 광고 단위 데이터 (campaign보다 세분화)
-- utm_content는 Meta url_tags에서 추출하여 leads와 매칭

CREATE TABLE IF NOT EXISTS ad_stats (
  id SERIAL PRIMARY KEY,
  clinic_id INTEGER REFERENCES clinics(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL,
  ad_id VARCHAR(100) NOT NULL,
  ad_name VARCHAR(500),
  campaign_id VARCHAR(100),
  campaign_name VARCHAR(500),
  utm_content VARCHAR(200),
  spend_amount NUMERIC(12,2) DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  stat_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- clinic_id NOT NULL 일 때 unique
ALTER TABLE ad_stats
  ADD CONSTRAINT ad_stats_clinic_platform_ad_date_key
  UNIQUE (clinic_id, platform, ad_id, stat_date);

-- clinic_id IS NULL 폴백 (환경변수 모드)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_stats_fallback
  ON ad_stats (platform, ad_id, stat_date)
  WHERE clinic_id IS NULL;

-- 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_ad_stats_clinic_date ON ad_stats(clinic_id, stat_date DESC);
CREATE INDEX IF NOT EXISTS idx_ad_stats_utm ON ad_stats(clinic_id, utm_content);
CREATE INDEX IF NOT EXISTS idx_ad_stats_campaign ON ad_stats(clinic_id, campaign_id);
