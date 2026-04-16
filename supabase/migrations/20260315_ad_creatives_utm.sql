-- 광고 소재 테이블에 전체 UTM 파라미터 컬럼 추가
ALTER TABLE ad_creatives ADD COLUMN IF NOT EXISTS utm_source VARCHAR(100);
ALTER TABLE ad_creatives ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(100);
ALTER TABLE ad_creatives ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(100);
ALTER TABLE ad_creatives ADD COLUMN IF NOT EXISTS utm_term VARCHAR(100);
