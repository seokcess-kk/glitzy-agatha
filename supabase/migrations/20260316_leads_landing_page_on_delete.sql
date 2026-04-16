-- leads.landing_page_id 외래키에 ON DELETE SET NULL 추가
-- 기존 제약조건 삭제 후 재생성
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_landing_page_id_fkey;
ALTER TABLE leads
  ADD CONSTRAINT leads_landing_page_id_fkey
  FOREIGN KEY (landing_page_id) REFERENCES landing_pages(id) ON DELETE SET NULL;
