# Memo App - AI Agent 지침서

## 프로젝트 개요

메모 CRUD 기능을 제공하는 Next.js 웹 애플리케이션. Supabase(Postgres)에 Server Action으로 데이터를 영속화하며, 카테고리 분류 및 검색 기능을 지원한다.

## Tech Stack

- **Framework:** Next.js 16.2.9 (App Router)
- **Language:** TypeScript 5.x (strict mode)
- **UI:** React 19.1.0 + Tailwind CSS 4.x
- **State:** Client-side state (useState, useCallback, useMemo)
- **Persistence:** Supabase (Postgres, `@supabase/supabase-js`, Server Actions 경유)
- **AI:** Google Gemini (`gemini-3.5-flash-lite`, Server Action 경유, 메모 요약 전용)
- **Testing:** Playwright (E2E)
- **Linting:** ESLint + Prettier

## Operational Commands

```bash
# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 린트 검사
npm run lint

# 코드 포맷팅
npm run format

# E2E 테스트 실행
npm run test

# 테스트 (헤드 모드)
npm run test:headed

# 테스트 UI 모드
npm run test:ui
```

## Golden Rules

### Immutable (절대 위반 금지)

1. `'use client'` 지시문이 필요한 컴포넌트에서 반드시 명시할 것
2. 브라우저 전용 API(`window` 등) 접근 시 SSR 환경 체크 (`typeof window === 'undefined'`) 필수. Supabase는 Server Action(서버)에서만 접근
3. 메모 ID 생성은 uuid v4만 사용
4. TypeScript strict mode 위반 금지
5. 민감 파일(`.env`, `.env.*`, `*secret*`, `*credential*`, `*.pem`, `*.key`)은 읽기·수정 절대 금지. Read/Edit 도구뿐 아니라 Bash(`cat`, `type`, `Get-Content` 등)로 우회해서 접근하는 것도 금지 (`.claude/settings.json`의 `permissions.deny`로 강제)

### Do's (권장 사항)

- 컴포넌트는 함수형 컴포넌트로 작성
- 상태 변경 함수는 useCallback으로 메모이제이션
- 파생 상태는 useMemo로 계산
- 파일명은 PascalCase (컴포넌트), camelCase (유틸, 훅)
- 한국어 UI 텍스트 사용
- Tailwind 유틸리티 클래스 우선 사용
- 화면(UI)을 바꾸는 작업이 끝나면 Playwright MCP로 브라우저를 열어 직접 확인하고, 확인한 내용을 사용자에게 보고할 것

### Don'ts (금지 사항)

- Class 컴포넌트 사용 금지
- any 타입 사용 금지 (불가피한 경우 주석으로 사유 명시)
- 인라인 스타일 지양 (Tailwind 사용)
- console.log를 프로덕션 코드에 남기지 않음 (에러 로깅 제외)
- 외부 상태 관리 라이브러리 도입 금지 (현재 규모에서 불필요)
- 민감 파일 접근이 막혔을 때 다른 방법으로 우회하지 말 것. 내용이 필요하면 사용자에게 요청
- API 키 등 비밀 값을 코드, 로그, 응답에 직접 노출하지 않음 (환경 변수로만 참조)

## 프로젝트 구조

```
src/
├── app/           # Next.js App Router 페이지
├── components/    # React 컴포넌트
├── hooks/         # 커스텀 훅
├── types/         # TypeScript 타입 정의
└── utils/         # 유틸리티 함수
```

## Standards & References

### 코딩 컨벤션

- ESLint: `eslint-config-next` 기반
- Prettier: `.prettierrc` 설정 준수
- Import 순서: React -> 외부 라이브러리 -> 내부 모듈 (`@/` alias 사용)

### Git 전략

- 커밋 메시지: 한국어로 작성
- 브랜치: feature/, fix/, refactor/ 접두사 사용

### Maintenance Policy

규칙과 실제 코드 구현 간 괴리가 발생하면, 코드를 기준으로 이 문서의 업데이트를 제안하라.

## Context Map (Action-Based Routing)

- **[페이지 및 레이아웃 (App Router)](./src/app/AGENTS.md)** — 라우팅, 페이지 컴포넌트, 메타데이터 작업 시
- **[UI 컴포넌트 (Components)](./src/components/AGENTS.md)** — 재사용 가능한 UI 컴포넌트 작성/수정 시
- **[상태 관리 (Hooks)](./src/hooks/AGENTS.md)** — 커스텀 훅 및 상태 로직 작업 시
- **[타입 정의 (Types)](./src/types/AGENTS.md)** — 인터페이스 및 타입 정의 시
- **[유틸리티 (Utils)](./src/utils/AGENTS.md)** — 헬퍼 함수, Supabase 클라이언트 작업 시
