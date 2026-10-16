import { test, expect, Page } from '@playwright/test'
import {
  cleanupMemos,
  createMemoViaUi,
  gotoAndWaitForList,
  memoCard,
  uniqueTitle,
} from './helpers/memoHelpers'

// 요약은 Server Action(summarizeMemo / getMemoSummary)이 서버에서 Gemini를 호출한다.
// 서버 내부 호출은 브라우저에서 모킹할 수 없으므로 성공 경로는 실제 Gemini를 사용하고,
// 실패 경로는 Server Action 요청(POST + Next-Action 헤더)을 가로채 500으로 응답한다.
// 테스트가 만든 메모는 정리 시 삭제되며, 요약 행은 FK cascade로 함께 삭제된다.

const LONG_CONTENT = '프로젝트 진행 상황을 정리한 긴 메모입니다. '.repeat(10)
const SUMMARY_TIMEOUT = 40_000

const isServerAction = (route: {
  request: () => { method: () => string; headers: () => Record<string, string> }
}) => {
  const request = route.request()
  return request.method() === 'POST' && 'next-action' in request.headers()
}

async function openMemo(page: Page, title: string) {
  await memoCard(page, title).click()
  await expect(page.getByTestId('memo-viewer')).toBeVisible()
}

async function createAndOpenLongMemo(page: Page, title: string) {
  await gotoAndWaitForList(page)
  await createMemoViaUi(page, { title, content: LONG_CONTENT })
  await openMemo(page, title)
}

test.describe('메모 AI 요약', () => {
  test('요약하기를 누르기 전에는 요약이 생성되지 않고 버튼만 보인다', async ({
    page,
  }) => {
    const title = uniqueTitle('E2E 요약 대기')
    try {
      await createAndOpenLongMemo(page, title)

      await expect(page.getByTestId('memo-summary-start-btn')).toBeVisible()
      await expect(page.getByTestId('memo-summary-text')).toHaveCount(0)
      await expect(page.getByTestId('memo-summary-loading')).toHaveCount(0)
    } finally {
      await cleanupMemos(page, [title])
    }
  })

  test('짧은 메모는 요약 카드가 표시되지 않는다', async ({ page }) => {
    const title = uniqueTitle('E2E 짧은 메모')
    try {
      await gotoAndWaitForList(page)
      await createMemoViaUi(page, { title, content: '짧은 내용' })
      await openMemo(page, title)

      await expect(page.getByTestId('memo-viewer-content')).toContainText(
        '짧은 내용'
      )
      await expect(page.getByTestId('memo-summary')).toHaveCount(0)
    } finally {
      await cleanupMemos(page, [title])
    }
  })

  test('요약 생성 후 숨김 토글과 재열람·새로고침 시 저장된 요약이 유지된다 (실제 Gemini)', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const title = uniqueTitle('E2E 요약 성공')
    const externalCalls: string[] = []
    page.on('request', request => {
      if (request.url().includes('generativelanguage.googleapis.com')) {
        externalCalls.push(request.url())
      }
    })

    try {
      await createAndOpenLongMemo(page, title)
      await page.getByTestId('memo-summary-start-btn').click()

      const text = page.getByTestId('memo-summary-text')
      await expect(text).not.toHaveText('', { timeout: SUMMARY_TIMEOUT })
      await expect(page.getByTestId('memo-summary-start-btn')).toHaveCount(0)
      await expect(page.getByTestId('memo-summary-error')).toHaveCount(0)

      // 숨김 토글
      await page.getByTestId('memo-summary-toggle-btn').click()
      await expect(text).toHaveCount(0)
      await page.getByTestId('memo-summary-toggle-btn').click()
      await expect(text).toBeVisible()
      const summary = (await text.textContent()) ?? ''

      // 닫았다 다시 열어도 버튼 없이 같은 요약이 보인다
      await page.getByTestId('memo-viewer-close-btn').click()
      await openMemo(page, title)
      await expect(page.getByTestId('memo-summary-text')).toHaveText(summary)
      await expect(page.getByTestId('memo-summary-start-btn')).toHaveCount(0)

      // 새로고침 후에도 DB에 저장된 요약이 보인다
      await page.reload()
      await expect(memoCard(page, title)).toHaveCount(1)
      await openMemo(page, title)
      await expect(page.getByTestId('memo-summary-text')).toHaveText(summary)
      await expect(page.getByTestId('memo-summary-start-btn')).toHaveCount(0)

      // 브라우저는 Gemini를 직접 호출하지 않는다
      expect(externalCalls).toHaveLength(0)
    } finally {
      await cleanupMemos(page, [title])
    }
  })

  test('요약 실패 시 오류가 표시되고 다시 시도로 복구된다', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const title = uniqueTitle('E2E 요약 실패')
    try {
      await createAndOpenLongMemo(page, title)
      await expect(page.getByTestId('memo-summary-start-btn')).toBeVisible()

      // 요약 생성 요청만 실패시킨다 (저장된 요약 조회는 위에서 이미 끝남)
      await page.route('**/*', async route => {
        if (isServerAction(route)) {
          await route.fulfill({ status: 500, body: 'error' })
        } else {
          await route.continue()
        }
      })
      await page.getByTestId('memo-summary-start-btn').click()
      await expect(page.getByTestId('memo-summary-error')).toBeVisible()

      // 네트워크가 복구되면 다시 시도로 요약이 생성된다
      await page.unroute('**/*')
      await page.getByTestId('memo-summary-retry-btn').click()
      await expect(page.getByTestId('memo-summary-text')).not.toHaveText('', {
        timeout: SUMMARY_TIMEOUT,
      })
      await expect(page.getByTestId('memo-summary-error')).toHaveCount(0)
    } finally {
      await page.unroute('**/*').catch(() => undefined)
      await cleanupMemos(page, [title])
    }
  })

  test('요약이 로딩 중이어도 편집 버튼이 동작한다', async ({ page }) => {
    test.setTimeout(90_000)
    const title = uniqueTitle('E2E 요약 중 편집')
    try {
      await createAndOpenLongMemo(page, title)

      // 응답을 잠시 붙잡아 로딩 상태를 확실히 만든다
      await page.route('**/*', async route => {
        if (isServerAction(route)) {
          await new Promise(resolve => setTimeout(resolve, 1500))
        }
        await route.continue()
      })
      await page.getByTestId('memo-summary-start-btn').click()
      await expect(page.getByTestId('memo-summary-loading')).toBeVisible()

      await page.getByTestId('memo-viewer-edit-btn').click()
      await expect(page.getByTestId('memo-viewer')).toHaveCount(0)
      await expect(
        page.getByRole('heading', { name: '메모 편집' })
      ).toBeVisible()
      await page.getByRole('button', { name: '취소' }).click()
    } finally {
      // 지연 중인 핸들러가 남아 있어도 오류 없이 해제한다
      await page.unrouteAll({ behavior: 'ignoreErrors' })
      await cleanupMemos(page, [title])
    }
  })
})
