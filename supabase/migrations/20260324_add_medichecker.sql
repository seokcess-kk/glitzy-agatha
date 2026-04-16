-- MediChecker 통합: 의료광고 심의 검증 테이블 및 함수
-- mc_ 접두사로 기존 테이블과 네임스페이스 분리

-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- mc_law_articles: 법령 조문
-- ============================================
CREATE TABLE mc_law_articles (
  id SERIAL PRIMARY KEY,
  article TEXT NOT NULL,
  clause TEXT,
  subclause TEXT,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  full_text TEXT,
  penalty TEXT,
  keywords TEXT[] DEFAULT '{}',
  detection_difficulty TEXT CHECK (detection_difficulty IN ('keyword', 'context', 'complex')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- mc_procedures: 시술/진료 항목
-- ============================================
CREATE TABLE mc_procedures (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  aliases TEXT[] DEFAULT '{}',
  required_disclosures TEXT[] DEFAULT '{}',
  common_violations TEXT[] DEFAULT '{}',
  special_regulations TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- mc_relations: 법령-시술 관계 그래프
-- ============================================
CREATE TABLE mc_relations (
  id SERIAL PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id INT NOT NULL,
  relation_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id INT NOT NULL,
  weight FLOAT DEFAULT 1.0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mc_relations_source ON mc_relations(source_type, source_id);
CREATE INDEX idx_mc_relations_target ON mc_relations(target_type, target_id);
CREATE INDEX idx_mc_relations_type ON mc_relations(relation_type);

-- ============================================
-- mc_chunks: 임베딩 청크 (RAG 검색용)
-- ============================================
CREATE TABLE mc_chunks (
  id BIGSERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB NOT NULL DEFAULT '{}',
  article_id INT REFERENCES mc_law_articles(id),
  procedure_id INT REFERENCES mc_procedures(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NOTE: IVFFlat 인덱스는 데이터 시딩 후 생성해야 합니다.
-- 시딩 완료 후 아래 명령을 실행하세요:
-- CREATE INDEX idx_mc_chunks_embedding ON mc_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 20);

-- trigram 인덱스 (키워드 검색용)
CREATE INDEX idx_mc_chunks_content_trgm ON mc_chunks USING gin (content gin_trgm_ops);

-- ============================================
-- mc_verification_logs: 검증 이력 (테넌트 스코프)
-- ============================================
CREATE TABLE mc_verification_logs (
  id SERIAL PRIMARY KEY,
  clinic_id INT NOT NULL REFERENCES clinics(id),
  user_id INT NOT NULL REFERENCES users(id),
  ad_text TEXT NOT NULL,
  ad_type TEXT NOT NULL,
  risk_score INT,
  violation_count INT,
  violations JSONB,
  summary TEXT,
  metadata JSONB,
  processing_time_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mc_verification_logs_clinic_date ON mc_verification_logs(clinic_id, created_at DESC);

-- ============================================
-- Functions
-- ============================================

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
