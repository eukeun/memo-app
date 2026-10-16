import { test, expect, Page } from '@playwright/test'

// 브라우저는 Gemini를 직접 호출하지 않고 서버 프록시(/api/summarize)만 호출한다
const GEMINI_URL = '**/api/summarize'
const MOCK_SUMMARY = '모킹된 AI 요약 결과입니다.'

const now = new Date().toISOString()
const memos = [
  {
    id: 'long-memo',
    title: '긴 메모',
    content: '프로젝트 진행 상황을 정리한 긴 메모입니다. '.repeat(10),
    category: 'work',
    tags: [],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'short-memo',
    title: '짧은 메모',
    content: '짧은 내용',
    category: 'personal',
    tags: [],
    createdAt: now,
    updatedAt: now,
  },
]

const geminiBody = (summary: string) => ({ summary })

async function setup(page: Page) {
  await page.addInitScript(data => {
    localStorage.setItem('memo-app-memos', JSON.stringify(data))
  }, memos)
}

async function openMemo(page: Page, title: string) {
  await page.getByTestId('memo-card').filter({ hasText: title }).click()
  await expect(page.getByTestId('memo-viewer')).toBeVisible()
}

async function clickSummarize(page: Page) {
  await page.getByTestId('memo-summary-start-btn').click()
}

test.describe('메모 AI 요약', () => {
  test('요약하기 버튼을 누르기 전에는 API를 호출하지 않는다', async ({
    page,
  }) => {
    await setup(page)
    let calls = 0
    await page.route(GEMINI_URL, async route => {
      calls++
      await route.fulfill({ json: geminiBody(MOCK_SUMMARY) })
    })
    await page.goto('/')
    await openMemo(page, '긴 메모')

    await expect(page.getByTestId('memo-summary-start-btn')).toBeVisible()
    await expect(page.getByTestId('memo-summary-text')).toHaveCount(0)
    await page.waitForTimeout(500)
    expect(calls).toBe(0)
  })

  test('요약하기를 누르면 로딩 후 요약이 표시된다', async ({ page }) => {
    await setup(page)
    await page.route(GEMINI_URL, async route => {
      await new Promise(resolve => setTimeout(resolve, 1500))
      await route.fulfill({ json: geminiBody(MOCK_SUMMARY) })
    })
    await page.goto('/')
    await openMemo(page, '긴 메모')
    await clickSummarize(page)

    await expect(page.getByTestId('memo-summary-loading')).toBeVisible()
    await expect(page.getByTestId('memo-summary-text')).toHaveText(MOCK_SUMMARY)
    await expect(page.getByTestId('memo-summary-start-btn')).toHaveCount(0)
  })

  test('짧은 메모는 요약 카드가 없고 API를 호출하지 않는다', async ({
    page,
  }) => {
    await setup(page)
    let calls = 0
    await page.route(GEMINI_URL, async route => {
      calls++
      await route.fulfill({ json: geminiBody(MOCK_SUMMARY) })
    })
    await page.goto('/')
    await openMemo(page, '짧은 메모')

    await expect(page.getByTestId('memo-summary')).toHaveCount(0)
    expect(calls).toBe(0)
  })

  test('요약 실패 시 오류가 표시되고 다시 시도로 복구된다', async ({ page }) => {
    await setup(page)
    let calls = 0
    await page.route(GEMINI_URL, async route => {
      calls++
      if (calls === 1) {
        await route.fulfill({ status: 500, body: 'error' })
      } else {
        await route.fulfill({ json: geminiBody(MOCK_SUMMARY) })
      }
    })
    await page.goto('/')
    await openMemo(page, '긴 메모')
    await clickSummarize(page)

    await expect(page.getByTestId('memo-summary-error')).toBeVisible()
    await page.getByTestId('memo-summary-retry-btn').click()
    await expect(page.getByTestId('memo-summary-text')).toHaveText(MOCK_SUMMARY)
    expect(calls).toBe(2)
  })

  test('서버가 503을 반환하면 오류를 표시한다 (재시도는 서버에서 처리)', async ({
    page,
  }) => {
    await setup(page)
    let calls = 0
    await page.route(GEMINI_URL, async route => {
      calls++
      await route.fulfill({ status: 503, json: { error: 'unavailable' } })
    })
    await page.goto('/')
    await openMemo(page, '긴 메모')
    await clickSummarize(page)

    await expect(page.getByTestId('memo-summary-error')).toBeVisible()
    expect(calls).toBe(1)
  })

  test('요약 요청은 Gemini가 아닌 /api/summarize로만 전송된다', async ({
    page,
  }) => {
    await setup(page)
    const externalCalls: string[] = []
    page.on('request', r => {
      if (r.url().includes('generativelanguage.googleapis.com')) {
        externalCalls.push(r.url())
      }
    })
    await page.route(GEMINI_URL, route =>
      route.fulfill({ json: geminiBody(MOCK_SUMMARY) })
    )
    await page.goto('/')
    await openMemo(page, '긴 메모')
    await clickSummarize(page)

    await expect(page.getByTestId('memo-summary-text')).toBeVisible()
    expect(externalCalls).toHaveLength(0)
  })

  test('/api/summarize는 내용이 없는 요청을 400으로 거절한다', async ({
    request,
  }) => {
    const empty = await request.post('/api/summarize', {
      data: { content: '   ' },
    })
    expect(empty.status()).toBe(400)

    const invalid = await request.post('/api/summarize', {
      data: { content: 123 },
    })
    expect(invalid.status()).toBe(400)
  })

  test('숨김 토글로 요약을 숨기고 다시 열면 펼쳐진다', async ({ page }) => {
    await setup(page)
    await page.route(GEMINI_URL, route =>
      route.fulfill({ json: geminiBody(MOCK_SUMMARY) })
    )
    await page.goto('/')
    await openMemo(page, '긴 메모')
    await clickSummarize(page)

    const text = page.getByTestId('memo-summary-text')
    await expect(text).toBeVisible()
    await page.getByTestId('memo-summary-toggle-btn').click()
    await expect(text).toHaveCount(0)
    await page.getByTestId('memo-summary-toggle-btn').click()
    await expect(text).toBeVisible()

    await page.getByTestId('memo-summary-toggle-btn').click()
    await page.getByTestId('memo-viewer-close-btn').click()
    await openMemo(page, '긴 메모')
    await expect(page.getByTestId('memo-summary-text')).toBeVisible()
  })

  test('이미 요약한 메모를 다시 열면 API 호출 없이 요약이 표시된다', async ({
    page,
  }) => {
    await setup(page)
    let calls = 0
    await page.route(GEMINI_URL, async route => {
      calls++
      await route.fulfill({ json: geminiBody(MOCK_SUMMARY) })
    })
    await page.goto('/')
    await openMemo(page, '긴 메모')
    await clickSummarize(page)
    await expect(page.getByTestId('memo-summary-text')).toBeVisible()
    await page.getByTestId('memo-viewer-close-btn').click()

    await openMemo(page, '긴 메모')
    await expect(page.getByTestId('memo-summary-text')).toBeVisible()
    expect(calls).toBe(1)
  })

  test('요약이 로딩 중이어도 편집 버튼이 동작한다', async ({ page }) => {
    await setup(page)
    await page.route(GEMINI_URL, async route => {
      await new Promise(resolve => setTimeout(resolve, 1500))
      await route.fulfill({ json: geminiBody(MOCK_SUMMARY) })
    })
    await page.goto('/')
    await openMemo(page, '긴 메모')
    await clickSummarize(page)

    await expect(page.getByTestId('memo-summary-loading')).toBeVisible()
    await page.getByTestId('memo-viewer-edit-btn').click()
    await expect(page.getByTestId('memo-viewer')).toHaveCount(0)
  })
})
