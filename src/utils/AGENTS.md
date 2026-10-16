# Utils - AI Agent 지침서

## 모듈 역할

순수 유틸리티 함수 및 헬퍼 집합. 비즈니스 로직과 독립적인 재사용 가능한 기능을 제공한다.

## 의존성 관계

- `@/types/memo` — Memo 타입

## 유틸리티 목록

| 파일                | 역할                                                                                                                    |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `supabaseServer.ts` | **서버 전용** Supabase 클라이언트 (`getSupabase`, `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY` 사용)                       |
| `gemini.ts`         | **서버 전용** Gemini REST 호출 (`geminiUtils.generateSummary`, 503/429 자동 재시도, `GeminiError`), 모델/입력 상한 상수 |
| `summaryConfig.ts`  | `SUMMARY_MIN_LENGTH`                                                                                                    |

## 외부 API / 환경변수

- Gemini는 서버(Server Action `src/app/actions/memoActions.ts`)에서만 호출한다. 브라우저는 Server Action만 호출한다.
- 키는 `.env.local`의 `GEMINI_API_KEY`에 둔다(서버 전용, `NEXT_PUBLIC_` 접두사 금지). 이 변수는 `src/app/actions/memoActions.ts`에서만 읽으며, 컴포넌트/훅에서 `process.env.GEMINI_API_KEY`를 참조하지 않는다.
- `gemini.ts`는 클라이언트 코드(컴포넌트, 훅)에서 import 금지. 클라이언트는 Server Action을 호출한다.
- `.env.local`은 커밋하지 않는다 (`.gitignore`의 `.env*`). 환경변수는 dev 서버 재시작 후 반영된다.
- 모델 ID는 `gemini.ts`의 `GEMINI_MODEL` 한 곳에서만 관리한다.

## Implementation Patterns

### SSR 안전한 브라우저 API 접근

```typescript
export const browserUtil = {
  doSomething: (): ReturnType => {
    // SSR 환경 체크 필수
    if (typeof window === 'undefined') return defaultValue

    try {
      // 브라우저 API 사용
      return window.someApi()
    } catch (error) {
      console.error('Error:', error)
      return defaultValue
    }
  },
}
```

### 새 유틸리티 파일 작성 템플릿

```typescript
// 타입 import
import { SomeType } from '@/types/someType'

// 상수 정의
const STORAGE_KEY = 'app-key'

// 객체 형태로 관련 함수 그룹화
export const utilName = {
  method1: (param: ParamType): ReturnType => {
    // 구현
  },

  method2: (param: ParamType): ReturnType => {
    // 구현
  },
}
```

## Local Golden Rules

### Do's

- 모든 유틸리티는 순수 함수로 작성 (사이드 이펙트 최소화)
- SSR 환경 체크는 함수 최상단에서 수행
- 에러 발생 시 적절한 기본값 반환
- JSON 파싱/직렬화 시 try-catch 필수

### Don'ts

- React 훅 사용 금지 (유틸리티는 훅이 아님)
- 전역 상태 변경 금지
- 직접 DOM 조작 금지 (React에 위임)
- 비동기 함수에서 에러 무시 금지

## 테스트 고려사항

유틸리티 함수는 단위 테스트하기 용이함:

- 순수 함수는 입력 -> 출력 테스트
- LocalStorage 의존 함수는 모킹 필요

## Supabase (데이터 영속화)

- 메모 CRUD와 요약은 `src/app/actions/memoActions.ts`(Server Action)에서 `supabaseServer.ts`로 처리한다. LocalStorage는 더 이상 사용하지 않는다.
- 환경변수(`.env.local`, 서버 전용 — `NEXT_PUBLIC_` 접두사 금지): `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`. Gemini 키는 `GEMINI_API_KEY`를 Server Action에서만 읽는다.
- 테이블: `memos`(snake_case 컬럼, `toMemo`로 `Memo` camelCase 변환), `memo_summaries`(`memo_updated_at`이 메모 `updated_at`과 같을 때만 유효한 요약).
- RLS는 활성화되어 있고 인증이 없는 앱이라 anon/authenticated에 전체 허용 정책을 둔다. 인증 도입 시 정책을 `auth.uid()` 기준으로 교체한다.
