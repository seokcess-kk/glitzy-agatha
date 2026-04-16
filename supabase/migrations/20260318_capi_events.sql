-- Meta Conversions API (CAPI) 이벤트 로그 테이블
CREATE TABLE IF NOT EXISTS capi_events (
  id bigserial PRIMARY KEY,
  clinic_id int NOT NULL REFERENCES clinics(id),
  lead_id bigint REFERENCES leads(id),
  event_id text NOT NULL,
  event_name text NOT NULL DEFAULT 'Lead',
  pixel_id text NOT NULL,
  user_phone_hash text,
  user_email_hash text,
  user_fn_hash text,
  event_source_url text,
  status text NOT NULL DEFAULT 'pending',
  meta_response jsonb,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_capi_events_clinic_id ON capi_events(clinic_id);
CREATE INDEX idx_capi_events_event_id ON capi_events(event_id);
CREATE INDEX idx_capi_events_status ON capi_events(status);
CREATE INDEX idx_capi_events_created_at ON capi_events(created_at DESC);

COMMENT ON TABLE capi_events IS 'Meta Conversions API 전송 이벤트 로그';
COMMENT ON COLUMN capi_events.event_id IS '브라우저 Pixel과 서버 CAPI 중복 제거용 UUID';
COMMENT ON COLUMN capi_events.status IS 'pending / success / fail';
