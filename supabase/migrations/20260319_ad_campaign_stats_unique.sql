-- ad_campaign_stats UNIQUE 제약을 clinic_id 포함으로 변경
-- 기존: (platform, campaign_id, stat_date) → 병원별 동기화 시 충돌 가능
-- 변경: (clinic_id, platform, campaign_id, stat_date) → 병원별 독립 데이터

-- 기존 UNIQUE 제약 삭제
ALTER TABLE ad_campaign_stats
  DROP CONSTRAINT IF EXISTS ad_campaign_stats_platform_campaign_id_stat_date_key;

-- 새 UNIQUE 제약 (clinic_id 포함, NOT NULL인 경우)
-- PostgreSQL에서 NULL != NULL이므로, clinic_id가 NULL인 행은 이 제약으로 중복 방지 불가
-- → 환경변수 폴백(clinic_id=NULL)용 별도 partial unique index 추가
ALTER TABLE ad_campaign_stats
  ADD CONSTRAINT ad_campaign_stats_clinic_platform_campaign_date_key
  UNIQUE (clinic_id, platform, campaign_id, stat_date);

-- 환경변수 폴백(clinic_id IS NULL)용 partial unique index
-- clinic_api_configs 미설정 시 clinic_id 없이 동기화되는 데이터의 중복 방지
CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_campaign_stats_fallback_unique
  ON ad_campaign_stats (platform, campaign_id, stat_date)
  WHERE clinic_id IS NULL;
