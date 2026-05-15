-- ad_creatives: 외부 URL 컬럼 추가
-- 랜딩페이지(landing_page_id) 대신 외부 URL을 직접 지정하기 위한 필드.
-- 두 필드는 UI/API에서 양자택일(둘 중 하나만 입력)로 강제한다.
ALTER TABLE ad_creatives
  ADD COLUMN IF NOT EXISTS external_url TEXT;

COMMENT ON COLUMN ad_creatives.external_url IS
  '외부 URL — landing_page_id 대신 직접 지정. 양자택일(상호 배타).';
