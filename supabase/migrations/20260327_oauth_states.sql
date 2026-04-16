-- OAuth CSRF state 토큰 임시 저장 테이블
CREATE TABLE IF NOT EXISTS oauth_states (
  id SERIAL PRIMARY KEY,
  state_token VARCHAR(128) NOT NULL,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 토큰 조회용 인덱스
CREATE INDEX idx_oauth_states_token ON oauth_states (state_token, platform);

-- 만료된 레코드 자동 정리용 인덱스
CREATE INDEX idx_oauth_states_expires ON oauth_states (expires_at);
