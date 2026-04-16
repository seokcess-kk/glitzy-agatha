# E2E 테스트

> 날짜: 2026-03-16 | 상태: 완료

전체 대시보드 페이지에 대한 Playwright E2E 테스트 커버리지 확보

---

## 구현 내용

| 항목 | 수량 |
|------|------|
| 테스트 스펙 | 14개 파일 |
| 테스트 케이스 | 106개 |
| Page Object | 13개 |
| CI 워크플로우 | GitHub Actions (e2e.yml) |

## 테스트 구조
```
e2e/
├── fixtures/auth.fixture.ts    # 인증 fixture (superadmin, clinic_admin)
├── pages/                       # Page Object 패턴
│   ├── login.page.ts
│   ├── dashboard.page.ts
│   ├── leads.page.ts
│   ├── utm.page.ts
│   ├── ads.page.ts
│   ├── patients.page.ts
│   ├── content.page.ts
│   ├── press.page.ts
│   ├── monitor.page.ts
│   ├── chatbot.page.ts
│   ├── lead-form.page.ts
│   └── admin.page.ts           # Users, Clinics, AdCreatives, LandingPages
├── tests/                       # 테스트 스펙
│   ├── auth.spec.ts             # 로그인/로그아웃/리다이렉트
│   ├── dashboard.spec.ts        # 대시보드 로드/네비게이션/멀티테넌트
│   ├── leads.spec.ts            # 리드 목록/검색/필터/상세/멀티테넌트
│   ├── utm.spec.ts              # UTM 생성/복사/히스토리/QR
│   ├── landing-page.spec.ts     # 랜딩페이지 접근/iframe/UTM/반응형
│   ├── ads.spec.ts              # 광고 KPI/필터/테이블/동기화
│   ├── patients.spec.ts         # 예약 목록/캘린더/확장/리다이렉트
│   ├── content.spec.ts          # 콘텐츠 KPI/필터/추가/검색
│   ├── press.spec.ts            # 언론보도 통계/기사/동기화
│   ├── monitor.spec.ts          # 모니터링 통계/위험도/분석
│   ├── chatbot.spec.ts          # 챗봇 통계/리드/발송률
│   ├── lead-form.spec.ts        # 리드폼 요소/UTM/경고
│   └── admin.spec.ts            # 계정/병원/소재/랜딩 CRUD/접근제어
└── utils/test-helpers.ts        # 토스트/API/날짜 헬퍼
```

## 설정 수정
- `playwright.config.ts`: testMatch 정규식 버그 수정, testIgnore 추가
- `.github/workflows/e2e.yml`: 인증/비인증 테스트 분리 실행

## 커밋
```
1edb6b5 test: Playwright E2E 테스트 106개 추가
```
