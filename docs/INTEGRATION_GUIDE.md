# Agatha 연동 가이드

## glitzy-web 확인/작업 사항

### 1. 현재 연동 구조

```
Agatha → glitzy-web 외부 API
         (기존 Samantha와 동일한 API 사용)

요청 예시:
GET /api/external/quotes?clinic_id=47
Authorization: Bearer {SERVICE_KEY}
```

Agatha는 내부적으로 `client_id`를 사용하지만, glitzy-web API 호출 시에는 기존과 동일하게 `clinic_id` 파라미터를 사용합니다. **glitzy-web 코드 변경은 불필요합니다.**

### 2. 확인 필요 사항

| # | 확인 항목 | 설명 |
|---|----------|------|
| 1 | **clinic_id 매핑 방식** | glitzy-web의 `/api/external/quotes?clinic_id=X`에서 `clinic_id`가 어떤 테이블/컬럼과 매핑되는지 확인. Agatha 클라이언트 관리에서 이 값을 `erp_client_id`로 입력해야 함 |
| 2 | **SERVICE_KEY 공유 여부** | Samantha와 동일한 SERVICE_KEY를 Agatha에서도 사용할지, 별도 발급할지 결정 |
| 3 | **동시 접근 문제** | Samantha와 Agatha가 같은 거래처(clinic_id)에 동시 접근 시 문제 없는지 확인 (읽기 전용이면 문제 없음, 견적 승인/반려는 주의) |

### 3. Agatha에 전달해야 할 정보

| 정보 | 용도 | 설정 위치 |
|------|------|----------|
| `ERP_API_URL` | glitzy-web 외부 API URL (예: `https://glitzy-web.com/api/external`) | Agatha `.env.local` + Vercel 환경변수 |
| `ERP_SERVICE_KEY` | 서비스 간 인증 키 | Agatha `.env.local` + Vercel 환경변수 |
| 거래처 ID 목록 | Agatha 클라이언트 등록 시 `erp_client_id`에 입력할 값 | Agatha 관리자 화면에서 수동 입력 |

### 4. API 엔드포인트 (Agatha가 호출하는 것들)

| Method | Path | 용도 |
|--------|------|------|
| GET | `/api/external/quotes?clinic_id=&status=&page=&limit=` | 견적서 목록 |
| GET | `/api/external/quotes/:id?clinic_id=` | 견적서 상세 |
| GET | `/api/external/invoices?clinic_id=&status=&page=&limit=` | 계산서 목록 |
| GET | `/api/external/invoices/:id?clinic_id=` | 계산서 상세 |
| PATCH | `/api/external/quotes/:id/respond` | 견적서 승인/반려 |

### 5. 추후 개선 (선택)

- Agatha용 별도 SERVICE_KEY 발급 → API 호출 로깅/모니터링 분리
- 거래처 목록 조회 API 제공 → Agatha 클라이언트 등록 시 드롭다운 선택 가능
  - 예: `GET /api/external/clients` → `[{ id: 47, name: "A렌트카" }, ...]`
- 거래처 생성 시 webhook 발송 → Agatha에 자동 알림

---

## Samantha 확인/작업 사항

### 1. 변경 사항: 없음

Samantha의 기존 ERP 연동은 그대로 유지됩니다. 코드 변경 불필요.

```
Samantha → glitzy-web 외부 API (기존과 동일)
GET /api/external/quotes?clinic_id={clinics.id}
```

### 2. 확인 필요 사항

| # | 확인 항목 | 설명 |
|---|----------|------|
| 1 | **clinics.id = glitzy-web clinic_id?** | Samantha의 `clinics.id`가 glitzy-web 외부 API의 `clinic_id`와 직접 매핑되는지 확인. 매핑 방식에 따라 Agatha의 `erp_client_id` 설정이 달라짐 |
| 2 | **견적 승인/반려 충돌** | 같은 거래처의 견적서를 Samantha와 Agatha 양쪽에서 승인/반려할 수 있는 경우, 어느 쪽에서 처리할지 운영 규칙 필요 |

### 3. Samantha ↔ Agatha 거래처 ID 매핑 예시

```
glitzy-web 거래처:
├── ID: 12 (B병원)     → Samantha clinics.id=12로 사용
├── ID: 47 (A렌트카)   → Agatha clients.erp_client_id=47로 사용
├── ID: 53 (C학원)     → Agatha clients.erp_client_id=53으로 사용
└── ID: 8  (D의원)     → Samantha clinics.id=8로 사용
```

- 병원 거래처: Samantha에서 관리
- 비병원 거래처: Agatha에서 관리
- 같은 거래처를 양쪽에서 조회하는 것도 가능 (읽기는 충돌 없음)

### 4. 추후 고려 (선택)

Samantha에서도 `erp_client_id` 방식으로 전환하면 glitzy-web 거래처 ID와 Samantha 내부 ID가 분리되어 더 유연해짐. 단, 현재 1:1 매핑이 잘 동작하면 변경 불필요.

---

*작성일: 2026-04-16*
*Agatha 프로젝트 연동 가이드 v1.0*
