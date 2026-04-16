---
name: agatha-orchestrator
description: "Agatha 구현 오케스트레이터. 기능 구현 시 Planner→Frontend+Backend(병렬)→QA 파이프라인을 자동으로 조율한다. 새로운 기능을 구현하거나, 여러 에이전트의 협업이 필요할 때, '구현해줘', '만들어줘', '페이지 작업' 같은 요청 시 반드시 이 스킬을 사용할 것."
---

# Agatha Implementation Orchestrator

## 목적

Agatha 기능 구현을 체계적으로 조율한다. 계획 → 병렬 구현 → 검증 파이프라인을 통해 품질을 보장하면서 병렬 작업으로 속도를 높인다.

## 실행 모드

**에이전트 팀 (Fan-out/Fan-in + Pipeline 혼합)**

```
Phase 1: Planning (Planner 단독)
    ↓ API 계약 + 작업 분해
Phase 2: Implementation (Frontend + Backend 병렬)
    ↓ 모듈 완성 시마다
Phase 3: QA (점진적 검증)
    ↓ 이슈 발견 시 수정 요청
Phase 4: Consolidation (통합 + 최종 빌드)
```

## Phase 1: 계획 수립

1. 사용자의 구현 요청을 분석한다
2. `docs/SPEC.md`와 `docs/DESIGN_SYSTEM.md`를 읽는다
3. `_workspace/00_input/` 디렉토리에 요청 사항을 저장한다
4. **agatha-planner** 에이전트를 실행한다:

```
Agent(
  description: "기능 구현 계획 수립",
  prompt: "[에이전트 정의: .claude/agents/agatha-planner.md 참조]
    구현 대상: {기능 설명}
    SPEC: docs/SPEC.md
    DESIGN_SYSTEM: docs/DESIGN_SYSTEM.md
    
    산출물:
    1. _workspace/01_planner_plan.md (구현 계획)
    2. _workspace/01_planner_api-contract.md (API 계약)
    3. _workspace/01_planner_tasks.md (Frontend/Backend/QA 작업 목록)",
  model: "opus"
)
```

5. 계획 산출물을 확인한다

## Phase 2: 병렬 구현

팀을 구성하고 Frontend/Backend를 병렬로 실행한다.

```
TeamCreate(
  team_name: "agatha-impl-team",
  members: [
    {
      name: "frontend",
      agent_type: "general-purpose",
      model: "opus",
      prompt: "[에이전트 정의: .claude/agents/agatha-frontend.md 참조]
        작업 목록: _workspace/01_planner_tasks.md의 Frontend 섹션
        API 계약: _workspace/01_planner_api-contract.md
        스킬 참조: .claude/skills/agatha-design-system/skill.md"
    },
    {
      name: "backend",
      agent_type: "general-purpose",
      model: "opus",
      prompt: "[에이전트 정의: .claude/agents/agatha-backend.md 참조]
        작업 목록: _workspace/01_planner_tasks.md의 Backend 섹션
        API 계약: _workspace/01_planner_api-contract.md
        스킬 참조: .claude/skills/agatha-api/skill.md, .claude/skills/agatha-multitenant/skill.md"
    }
  ]
)

TaskCreate([
  { title: "Backend: DB 마이그레이션", assignee: "backend" },
  { title: "Backend: API 라우트 구현", assignee: "backend", depends_on: ["Backend: DB 마이그레이션"] },
  { title: "Frontend: 페이지 구현", assignee: "frontend" },
  { title: "Frontend: API 연결", assignee: "frontend", depends_on: ["Backend: API 라우트 구현"] }
])
```

**병렬 실행 핵심:**
- API 계약이 Phase 1에서 미리 정의되어 있으므로 Frontend는 목 데이터로 먼저 UI를 구현
- Backend는 DB → API 순서로 구현
- Backend API 완료 시 Frontend에 SendMessage로 알림 → Frontend가 실제 API 연결

## Phase 3: 점진적 QA

**모듈 완성 시마다 즉시 검증** (전체 완성 대기 X)

```
Agent(
  description: "모듈 통합 검증",
  prompt: "[에이전트 정의: .claude/agents/agatha-qa.md 참조]
    검증 대상: {완성된 모듈}
    체크리스트: agatha-qa.md의 QA 체크리스트
    산출물: _workspace/03_qa_report.md",
  model: "opus"
)
```

QA 결과:
- **PASS** → Phase 4로 진행
- **FAIL** → 해당 에이전트에 수정 요청 (SendMessage) → 수정 후 재검증 (최대 2회)

## Phase 4: 통합 및 빌드

1. 모든 작업 결과를 확인한다
2. `npm run build` 실행 → 타입 에러 수정
3. `npm run lint` 실행 → 린트 에러 수정
4. 최종 결과를 `_workspace/04_summary.md`에 기록한다
5. 팀을 정리한다

```
TeamDelete(team_name: "agatha-impl-team")
```

## 데이터 전달

| 단계 | 전달 방식 | 경로 |
|------|----------|------|
| 요청 → Planner | 파일 | `_workspace/00_input/` |
| Planner → Team | 파일 | `_workspace/01_planner_*.md` |
| Team 내부 | SendMessage | 실시간 |
| Team → QA | 파일 + 메시지 | `_workspace/02_impl_*.md` |
| QA → Team | SendMessage | 수정 요청 |
| 최종 결과 | 파일 | `_workspace/04_summary.md` |

## 에러 핸들링

| 상황 | 대응 |
|------|------|
| Planner 결과 불충분 | 추가 분석 요청 (1회 재시도) |
| 빌드 실패 | 에러 로그 분석 → 해당 에이전트에 수정 요청 |
| QA 2회 실패 | 이슈 목록과 함께 사용자에게 보고 |
| 외부 API 연동 실패 | 목 데이터로 대체, 이후 연결 |

## 테스트 시나리오

### 정상 흐름
1. "대시보드 페이지 구현해줘"
2. Planner → KPI 카드, 채널별 테이블, 퍼널 차트, 트렌드 차트 작업 분해
3. Frontend: 페이지 + 컴포넌트 구현 / Backend: KPI API + 트렌드 API 구현 (병렬)
4. QA: API 응답 ↔ 프론트 타입 교차 검증 → PASS
5. 빌드 성공 → 완료

### 에러 흐름
1. "고객관리 페이지 구현해줘"
2. Backend: leads API 완료, 리드 상태 전이 누락
3. QA: `hold → in_progress` 전이 코드 미구현 발견 → FAIL
4. Backend에 수정 요청 → 수정 후 재검증 → PASS
5. 빌드 성공 → 완료
