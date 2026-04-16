# MediChecker — 의료광고 검증 모듈

## 개요

의료법 제56조(의료광고 금지 행위) 기반 AI 검증 도구.
광고 텍스트를 입력하면 7단계 파이프라인을 거쳐 위반 여부를 판별하고, 수정 제안까지 제공합니다.

**원본 프로젝트**: [seokcess-kk/medichecker](https://github.com/seokcess-kk/medichecker)
**통합 방식**: 도메인 서비스를 `lib/medichecker/`로 이식, Samantha 멀티테넌트 아키텍처에 맞춤

---

## 아키텍처

```
사용자 입력 (text + adType)
    │
    ▼
[1] 키워드 스캔 ─────────┐  (regex, ~50ms)
[2] 컨텍스트 분류 ────────┤  (Claude Haiku, ~1s)   ← 1,2 병렬
    │                     │
    ▼                     │
[3] 쿼리 변환 ────────────┘  (Claude Haiku, ~1s)
    │
    ▼
[4] RAG 하이브리드 검색       (pgvector + pg_trgm, ~300ms)
    │
    ▼
[4.5] 온톨로지 관계 확장      (PostgreSQL 1홉 탐색, ~100ms)
    │
    ▼
[5] 위반 판단                 (Claude Sonnet, ~4s)
    │
    ▼
[6] 자기 검증                 (Claude Sonnet, ~3s)
    │
    ▼
결과 (violations, riskScore, summary)
```

**총 처리 시간**: ~8-10초, **건당 비용**: ~$0.03

---

## 파일 구조

```
lib/medichecker/
├── types.ts              # 전체 타입 정의
├── verification.ts       # 7단계 파이프라인 오케스트레이터
├── analysis.ts           # 1~3단계: 키워드 스캔 + 분류 + 쿼리 변환
├── rag.ts               # 4단계: 하이브리드 검색 (시맨틱 + 키워드 RRF)
├── ontology.ts          # 4.5단계: 관계 기반 컨텍스트 확장
├── claude-client.ts     # 5~6단계: Claude API 래퍼
├── embedding.ts         # OpenAI 임베딩 프로바이더
├── highlight.ts         # 위반 텍스트 위치 매칭 유틸리티
└── prompts/             # 시스템 프롬프트
    ├── classification.ts  # 2단계: 진료과목/시술 분류
    ├── query-rewrite.ts   # 3단계: 광고→법률 검색어 변환
    ├── judgment.ts        # 5단계: 위반 판단
    └── verification.ts    # 6단계: 자기 검증 (오탐 제거)

components/medichecker/
├── text-input-card.tsx       # 입력 + 하이라이트 전환
├── ad-type-selector.tsx      # 매체 유형 선택
├── verify-progress.tsx       # 7단계 진행 표시
├── result-kpi-cards.tsx      # 결과 KPI 4카드
├── violation-card.tsx        # 위반 상세 카드
├── violation-highlight.tsx   # 텍스트 하이라이트 렌더러
└── history-table.tsx         # 검수 이력 테이블

hooks/use-verification.ts    # SSE 스트리밍 훅

app/(dashboard)/medichecker/
├── page.tsx                 # 메인 페이지
└── layout.tsx               # 메타데이터

app/api/medichecker/
├── verify/route.ts          # POST: SSE 스트리밍 검증
├── history/route.ts         # GET: 이력 목록
└── history/[id]/route.ts    # GET: 이력 상세
```

---

## DB 스키마

### 공용 테이블 (mc_ 접두사, clinic_id 없음)

| 테이블 | 행 수 | 설명 |
|--------|-------|------|
| `mc_law_articles` | 15 | 의료법 제56조 제2항 제1~15호 |
| `mc_procedures` | 50 | 의료 시술 (보톡스, 필러, 임플란트 등) |
| `mc_relations` | ~100 | 법조문↔시술 온톨로지 관계 |
| `mc_chunks` | ~46 | RAG 임베딩 청크 (법률+가이드+사례) |

### 테넌트 테이블

| 테이블 | 설명 |
|--------|------|
| `mc_verification_logs` | 검증 이력 (clinic_id + user_id 추적) |

### RPC 함수

| 함수 | 용도 |
|------|------|
| `mc_search_similar_chunks` | pgvector 코사인 유사도 검색 (specialty/adType 필터) |
| `mc_search_keyword_chunks` | pg_trgm 트라이그램 키워드 검색 |
| `mc_get_related_context` | 법조문/시술 ID 배열 → 관련 청크 1홉 탐색 |

---

## 환경변수

| 변수 | 필수 | 용도 |
|------|------|------|
| `ANTHROPIC_API_KEY` | MediChecker 사용 시 | Claude Sonnet/Haiku API |
| `OPENAI_API_KEY` | MediChecker 사용 시 | text-embedding-3-small 임베딩 |

---

## 사용 전 필요 작업

### 1. 환경변수

`.env.local`에 추가:
```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

### 2. DB 마이그레이션

Supabase SQL Editor에서 `supabase/migrations/20260324_add_medichecker.sql` 실행.

### 3. 시드 데이터 적재

```bash
npx dotenv -e .env.local -- npx tsx scripts/seed-medichecker.ts
```

법조문 15건, 시술 50건, 청크 46건, 관계 100건이 mc_ 테이블에 적재됩니다.

### 4. 임베딩 생성

```bash
npx dotenv -e .env.local -- npx tsx scripts/seed-medichecker-embeddings.ts
```

mc_chunks의 46건에 OpenAI `text-embedding-3-small` (1536차원) 임베딩을 생성합니다.
비용: ~$0.001 미만.

### 5. IVFFlat 인덱스

임베딩 시딩 완료 후 Supabase SQL Editor에서:
```sql
CREATE INDEX idx_mc_chunks_embedding ON mc_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 20);
```

---

## 접근 권한

| 역할 | 접근 |
|------|------|
| `superadmin` | 전체 접근 |
| `agency_staff` | menuKey `medichecker` 권한 필요 |
| `clinic_admin` | 자기 병원 데이터만 |
| `clinic_staff` | 접근 차단 (minRole: 2) |

---

## 로드맵

### Phase 1: 핵심 기능 (완료)
- 7단계 AI 파이프라인 (키워드→분류→RAG→온톨로지→판단→검증)
- SSE 스트리밍 검증 API + 이력 목록/상세 API
- 2컬럼 결과 레이아웃 + 심각도 그룹핑 + 컴팩트 위반 카드
- DB 5테이블 + 시드 데이터 + 임베딩

### Phase 2: 운영 기능 (완료)
- logActivity 연동 — 검증 활동을 activity_logs에 기록 (verify route에서 INSERT 후 호출)
- 이력 상세 보기 — 이력 테이블에서 클릭 시 과거 검수 결과를 결과 UI에 로드

### Phase 3: 기존 기능 연계 (부분 완료)
- agency_staff 메뉴 권한에 medichecker 추가 (완료)
- 광고 소재 관리 → "검수" 버튼 연동 (예정)

### Phase 4: 고도화 (실사용 후 결정)
- 사용량 추적 / 월 quota 제한 (실사용 패턴 파악 후)
- 검증 결과 PDF 내보내기
- 반복 위반 패턴 분석
- 법률 데이터 CRUD 어드민

---

## 위반 신뢰도 색상 체계

| 신뢰도 | 레벨 | 하이라이트 | 카드 테두리 |
|--------|------|-----------|------------|
| 90%+ | 높음 | `bg-rose-500/20` | `border-l-rose-500` |
| 60-89% | 중간 | `bg-amber-500/20` | `border-l-amber-500` |
| 60% 미만 | 낮음 | `bg-muted` | `border-l-border` |
