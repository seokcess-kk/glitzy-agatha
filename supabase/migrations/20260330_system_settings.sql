-- 시스템 전역 설정 테이블
CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 숨김 메뉴 초기값 (현재 미사용 메뉴)
INSERT INTO system_settings (key, value)
VALUES ('hidden_menus', '["content", "monitor"]'::jsonb)
ON CONFLICT (key) DO NOTHING;
