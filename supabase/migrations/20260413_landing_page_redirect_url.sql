-- 랜딩페이지 폼 제출 후 이동할 URL
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS redirect_url TEXT DEFAULT NULL;

COMMENT ON COLUMN landing_pages.redirect_url IS '리드 폼 제출 성공 후 이동할 URL. NULL이면 이동 없이 완료 alert만 표시.';
