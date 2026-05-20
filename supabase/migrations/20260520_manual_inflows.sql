-- ============================================================================
-- Agatha — manual_inflows 테이블 (수동 인입 보정)
-- ============================================================================
--
-- 목적:
--   매체(특히 ADN)가 conv_cnt 매체 전환을 일부 누락하는 케이스에 대비해
--   클라이언트 × 매체 × 일자 단위로 수동 보정 인입 수를 기록.
--   인입 집계 시 manual_inflows.count 가 추가로 합산된다.
--
-- 멀티테넌트:
--   - client_id 필수, ON DELETE CASCADE (클라이언트 삭제 시 보정값도 정리)
--   - (client_id, platform, stat_date) UNIQUE — 일자별 1행만
-- ============================================================================

CREATE TABLE IF NOT EXISTS manual_inflows (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  platform VARCHAR(20) NOT NULL,
  stat_date DATE NOT NULL,
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  reason TEXT,
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT manual_inflows_unique UNIQUE (client_id, platform, stat_date)
);

CREATE INDEX IF NOT EXISTS idx_manual_inflows_client_date
  ON manual_inflows(client_id, stat_date DESC);

CREATE INDEX IF NOT EXISTS idx_manual_inflows_platform_date
  ON manual_inflows(platform, stat_date DESC);

COMMENT ON TABLE manual_inflows IS
  '수동 인입 보정 — 매체 트래킹 누락분을 일자 단위로 보정하는 값. 인입 KPI 집계 시 합산됨';
COMMENT ON COLUMN manual_inflows.count IS '추가 인입 수 (>= 0)';
COMMENT ON COLUMN manual_inflows.reason IS '보정 사유 메모 (선택)';
