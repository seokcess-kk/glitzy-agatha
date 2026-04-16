-- SMS 발송 로그 테이블
CREATE TABLE IF NOT EXISTS sms_send_logs (
  id BIGSERIAL PRIMARY KEY,
  clinic_id INTEGER REFERENCES clinics(id) ON DELETE SET NULL,
  lead_id BIGINT,
  phone VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | sent | retrying | failed
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_send_logs_clinic_id ON sms_send_logs(clinic_id);
CREATE INDEX IF NOT EXISTS idx_sms_send_logs_status ON sms_send_logs(status);
CREATE INDEX IF NOT EXISTS idx_sms_send_logs_created_at ON sms_send_logs(created_at);
