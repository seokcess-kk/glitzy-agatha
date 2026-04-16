-- 순위 모니터링: "함께많이찾는" 카테고리 추가
ALTER TABLE monitoring_keywords
  DROP CONSTRAINT monitoring_keywords_category_check,
  ADD CONSTRAINT monitoring_keywords_category_check
    CHECK (category IN ('place', 'website', 'smartblock', 'related'));
