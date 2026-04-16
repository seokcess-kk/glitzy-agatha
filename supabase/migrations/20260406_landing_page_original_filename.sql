-- 랜딩페이지 원본 파일명 보존 컬럼 추가
-- file_name은 Storage 참조용 (ASCII), original_file_name은 표시용 (원본)
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS original_file_name VARCHAR(200);
