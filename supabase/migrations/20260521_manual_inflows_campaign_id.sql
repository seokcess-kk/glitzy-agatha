-- ============================================================================
-- Agatha — manual_inflows.campaign_id 추가 (캠페인 귀속)
-- ============================================================================
--
-- 변경 사항:
--   - 보정값을 (client_id, platform, stat_date) 단위 → (..., campaign_id, stat_date)
--     단위로 변경. 캠페인 단위 인입 합계와 채널 KPI 가 자연스럽게 일치하도록.
--   - 기존 (캠페인 미지정) 보정값은 사용자 결정에 따라 삭제.
-- ============================================================================

BEGIN;

-- 1) 기존 NULL 보정값 삭제 (사용자 결정: 모두 삭제)
DELETE FROM manual_inflows;

-- 2) 기존 UNIQUE 제약 제거
ALTER TABLE manual_inflows DROP CONSTRAINT IF EXISTS manual_inflows_unique;

-- 3) campaign_id, campaign_name 컬럼 추가 (NOT NULL — 캠페인 선택 필수)
--    campaign_name 은 표시 편의 + 캠페인이 삭제/리네임되어도 보정 이력 유지를 위함.
ALTER TABLE manual_inflows ADD COLUMN campaign_id TEXT NOT NULL;
ALTER TABLE manual_inflows ADD COLUMN campaign_name TEXT;

-- 4) 새 UNIQUE 제약
ALTER TABLE manual_inflows
  ADD CONSTRAINT manual_inflows_unique
  UNIQUE (client_id, platform, campaign_id, stat_date);

-- 5) 캠페인별 조회용 인덱스
CREATE INDEX IF NOT EXISTS idx_manual_inflows_campaign
  ON manual_inflows(client_id, platform, campaign_id, stat_date DESC);

COMMENT ON COLUMN manual_inflows.campaign_id IS '귀속 캠페인 ID (ad_campaign_stats.campaign_id 와 매칭)';
COMMENT ON COLUMN manual_inflows.campaign_name IS '저장 시점 캠페인명 (캠페인 삭제 후에도 이력 유지)';

COMMIT;
