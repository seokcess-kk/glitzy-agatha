-- monitoring_keywords 테이블에 url 컬럼 추가 (선택값)
ALTER TABLE monitoring_keywords ADD COLUMN IF NOT EXISTS url TEXT;
