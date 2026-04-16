-- 랜딩페이지별 GTM ID 지원
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS gtm_id VARCHAR(20) DEFAULT NULL;

COMMENT ON COLUMN landing_pages.gtm_id IS 'Google Tag Manager ID (예: GTM-5B2QSHGG). NULL이면 기본 GTM ID 사용.';
