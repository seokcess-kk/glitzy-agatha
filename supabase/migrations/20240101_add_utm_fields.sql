-- Phase 1: leads 테이블에 UTM 필드 추가
-- 실행: Supabase Dashboard > SQL Editor에서 실행

-- 1. UTM 컬럼 추가
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS utm_source VARCHAR(50),
ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(50),
ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(100),
ADD COLUMN IF NOT EXISTS utm_content VARCHAR(200),
ADD COLUMN IF NOT EXISTS utm_term VARCHAR(100);

-- 2. 분석 쿼리 최적화를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_leads_utm_source ON leads(utm_source);
CREATE INDEX IF NOT EXISTS idx_leads_utm_campaign ON leads(utm_campaign);
CREATE INDEX IF NOT EXISTS idx_leads_clinic_created ON leads(clinic_id, created_at DESC);

-- 3. (선택) 기존 데이터 마이그레이션 - inflow_url에서 UTM 추출
-- 주의: 기존 데이터가 많은 경우 시간이 걸릴 수 있음
-- 필요한 경우 주석 해제하여 실행

/*
UPDATE leads
SET
  utm_source = (
    SELECT regexp_matches(inflow_url, 'utm_source=([^&]+)')
  )[1],
  utm_medium = (
    SELECT regexp_matches(inflow_url, 'utm_medium=([^&]+)')
  )[1],
  utm_campaign = (
    SELECT regexp_matches(inflow_url, 'utm_campaign=([^&]+)')
  )[1],
  utm_content = (
    SELECT regexp_matches(inflow_url, 'utm_content=([^&]+)')
  )[1],
  utm_term = (
    SELECT regexp_matches(inflow_url, 'utm_term=([^&]+)')
  )[1]
WHERE inflow_url IS NOT NULL
  AND inflow_url LIKE '%utm_%'
  AND utm_source IS NULL;
*/

-- 4. 확인 쿼리
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'leads' AND column_name LIKE 'utm%';
