-- MediChecker RPC 함수 생성/업데이트 + 컬럼 DEFAULT 수정
-- Supabase SQL Editor에서 실행하세요.

-- ============================================
-- 컬럼 DEFAULT 수정 (이전 마이그레이션에서 누락된 경우)
-- ============================================
ALTER TABLE mc_procedures ALTER COLUMN required_disclosures SET DEFAULT '{}';
ALTER TABLE mc_procedures ALTER COLUMN common_violations SET DEFAULT '{}';
ALTER TABLE mc_procedures ALTER COLUMN special_regulations SET DEFAULT '{}';

-- ============================================
-- 기존 함수 드롭 (시그니처 변경 대응)
-- ============================================
DROP FUNCTION IF EXISTS mc_search_similar_chunks;
DROP FUNCTION IF EXISTS mc_search_keyword_chunks;
DROP FUNCTION IF EXISTS mc_get_related_context;

-- mc_search_similar_chunks: 벡터 유사도 검색
CREATE OR REPLACE FUNCTION mc_search_similar_chunks(
  query_embedding vector(1536),
  match_count INT DEFAULT 10,
  filter_specialty TEXT DEFAULT NULL,
  filter_ad_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  id BIGINT,
  content TEXT,
  metadata JSONB,
  article_id INT,
  procedure_id INT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.content,
    c.metadata,
    c.article_id,
    c.procedure_id,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM mc_chunks c
  WHERE c.embedding IS NOT NULL
    AND (filter_specialty IS NULL OR c.metadata->>'specialty' = filter_specialty)
    AND (filter_ad_type IS NULL OR c.metadata->>'adType' = filter_ad_type)
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- mc_search_keyword_chunks: 키워드 기반 trigram 검색
CREATE OR REPLACE FUNCTION mc_search_keyword_chunks(
  query_text TEXT,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id BIGINT,
  content TEXT,
  metadata JSONB,
  article_id INT,
  procedure_id INT,
  sim_score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.content,
    c.metadata,
    c.article_id,
    c.procedure_id,
    similarity(c.content, query_text)::FLOAT AS sim_score
  FROM mc_chunks c
  WHERE c.content % query_text
  ORDER BY c.content <-> query_text
  LIMIT match_count;
END;
$$;

-- mc_get_related_context: 관계 그래프를 통한 연관 컨텍스트 조회 (1홉)
CREATE OR REPLACE FUNCTION mc_get_related_context(
  input_article_ids INT[],
  input_procedure_ids INT[]
)
RETURNS TABLE (
  chunk_id BIGINT,
  chunk_content TEXT,
  chunk_metadata JSONB,
  relation_type TEXT,
  relation_source TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  -- 조항에 연결된 관련 사례/규제 (1홉)
  SELECT c.id, c.content, c.metadata,
    r.relation_type,
    'article_relation' AS relation_source
  FROM mc_relations r
  JOIN mc_chunks c ON (r.target_type = 'chunk' AND r.target_id = c.id::INT)
  WHERE r.source_type = 'article'
    AND r.source_id = ANY(input_article_ids)
    AND r.relation_type IN ('relatedCase', 'prohibits', 'appliesTo')

  UNION ALL

  -- 시술에 연결된 관련 사례/규제 (1홉)
  SELECT c.id, c.content, c.metadata,
    r.relation_type,
    'procedure_relation' AS relation_source
  FROM mc_relations r
  JOIN mc_chunks c ON (r.target_type = 'chunk' AND r.target_id = c.id::INT)
  WHERE r.source_type = 'procedure'
    AND r.source_id = ANY(input_procedure_ids)
    AND r.relation_type IN ('commonViolation', 'requiredDisclosure', 'hasSpecialRegulation')

  UNION ALL

  -- 시술의 필수 고지사항 (procedures 테이블 직접)
  SELECT 0 AS chunk_id,
    'required_disclosure: ' || array_to_string(p.required_disclosures, ', '),
    jsonb_build_object('type', 'disclosure', 'procedure', p.name),
    'requiredDisclosure',
    'procedure_direct'
  FROM mc_procedures p
  WHERE p.id = ANY(input_procedure_ids)
    AND p.required_disclosures IS NOT NULL;
END;
$$;
