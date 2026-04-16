-- 광고 소재 썸네일/파일 지원
ALTER TABLE ad_creatives ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE ad_creatives ADD COLUMN IF NOT EXISTS file_type TEXT;
