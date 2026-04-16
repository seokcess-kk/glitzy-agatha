-- 광고 플랫폼 2계층 구조: campaign_type 컬럼 추가 + platform 값 통일 (meta_ads 형식)

-- 1. campaign_type 컬럼 추가
ALTER TABLE ad_campaign_stats ADD COLUMN IF NOT EXISTS campaign_type VARCHAR(50);
ALTER TABLE ad_stats ADD COLUMN IF NOT EXISTS campaign_type VARCHAR(50);
ALTER TABLE ad_creatives ADD COLUMN IF NOT EXISTS campaign_type VARCHAR(50);

-- 2. campaign_type 인덱스
CREATE INDEX IF NOT EXISTS idx_ad_campaign_stats_campaign_type
  ON ad_campaign_stats(clinic_id, campaign_type) WHERE campaign_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ad_stats_campaign_type
  ON ad_stats(clinic_id, campaign_type) WHERE campaign_type IS NOT NULL;

-- 3. platform 값 통일: 'Meta'/'Google'/'TikTok' → 'meta_ads'/'google_ads'/'tiktok_ads'

-- ad_campaign_stats
UPDATE ad_campaign_stats SET platform = 'meta_ads' WHERE platform = 'Meta';
UPDATE ad_campaign_stats SET platform = 'google_ads' WHERE platform = 'Google';
UPDATE ad_campaign_stats SET platform = 'tiktok_ads' WHERE platform = 'TikTok';

-- ad_stats
UPDATE ad_stats SET platform = 'meta_ads' WHERE platform = 'Meta';
UPDATE ad_stats SET platform = 'google_ads' WHERE platform = 'Google';
UPDATE ad_stats SET platform = 'tiktok_ads' WHERE platform = 'TikTok';

-- ad_creatives: 소문자 → _ads 형식
UPDATE ad_creatives SET platform = 'meta_ads' WHERE platform = 'meta';
UPDATE ad_creatives SET platform = 'google_ads' WHERE platform = 'google';
UPDATE ad_creatives SET platform = 'tiktok_ads' WHERE platform = 'tiktok';
UPDATE ad_creatives SET platform = 'naver_ads' WHERE platform = 'naver';
UPDATE ad_creatives SET platform = 'kakao_ads' WHERE platform = 'kakao';
UPDATE ad_creatives SET platform = 'dable_ads' WHERE platform = 'dable';

-- 코멘트
COMMENT ON COLUMN ad_campaign_stats.campaign_type IS '캠페인 타입 (search, gdn, demand_gen, pmax, youtube, feed, reels 등). nullable.';
COMMENT ON COLUMN ad_stats.campaign_type IS '캠페인 타입. nullable.';
COMMENT ON COLUMN ad_creatives.campaign_type IS '캠페인 타입. nullable.';
