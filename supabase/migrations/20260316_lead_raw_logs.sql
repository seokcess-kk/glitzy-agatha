-- 리드 원본 로그 테이블 (유실 방지용)
-- webhook 수신 즉시 저장, 처리 결과 업데이트
CREATE TABLE IF NOT EXISTS lead_raw_logs (
  id BIGSERIAL PRIMARY KEY,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',  -- received | processed | failed
  clinic_id INTEGER,
  lead_id BIGINT,
  idempotency_key TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_lead_raw_logs_status ON lead_raw_logs(status);
CREATE INDEX IF NOT EXISTS idx_lead_raw_logs_created_at ON lead_raw_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_lead_raw_logs_clinic_id ON lead_raw_logs(clinic_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_raw_logs_idempotency ON lead_raw_logs(idempotency_key) WHERE idempotency_key IS NOT NULL;
