import { expect, Page } from '@playwright/test'

// 앱은 실제 Supabase DB를 사용하므로, 테스트가 만든 메모는 반드시 정리한다.

const TOTAL_TEXT = /총 (\d+)개의 메모/

export const uniqueTitle = (prefix: string) =>
  `${prefix} ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

export const memoCard = (page: Page, title: string) =>
  page.getByTestId('memo-card').filter({ hasText: title })

export async function gotoAndWaitForList(page: Page) {
  await page.goto('/')
  await expect(page.getByTestId('memo-card').first()).toBeVisible()
}

export async function readTotal(page: Page): Promise<number> {
  const label = page.getByText(TOTAL_TEXT)
  await expect(label).toBeVisible()
  const text = (await label.textContent()) ?? ''
  const match = text.match(TOTAL_TEXT)
  if (!match) throw new Error(`메모 개수 텍스트를 읽지 못했습니다: "${text}"`)
  return Number(match[1])
}

export const contentEditor = (page: Page) =>
  page
    .getByTestId('memo-content-editor')
    .getByRole('textbox', { name: '내용 * (마크다운 지원)' })

// UI로 메모를 만들고 카드가 나타날 때까지 기다린다
export async function createMemoViaUi(
  page: Page,
  memo: { title: string; content: string; category?: string }
) {
  await page.getByRole('button', { name: '새 메모' }).click()
  await expect(
    page.getByRole('heading', { name: '새 메모 작성' })
  ).toBeVisible()
  await page.getByRole('textbox', { name: '제목 *' }).fill(memo.title)
  if (memo.category) {
    await page
      .getByRole('combobox', { name: '카테고리' })
      .selectOption({ label: memo.category })
  }
  await contentEditor(page).fill(memo.content)
  await page.getByRole('button', { name: '저장하기' }).click()
  await expect(memoCard(page, memo.title)).toHaveCount(1)
}

// 고유 제목의 카드만 삭제한다 (목업 메모는 건드리지 않는다)
export async function deleteMemoByTitle(page: Page, title: string) {
  const cards = memoCard(page, title)
  const before = await cards.count()
  if (before === 0) return
  page.once('dialog', dialog => dialog.accept())
  await cards.first().getByRole('button', { name: '삭제' }).click()
  await expect(cards).toHaveCount(before - 1)
}

// 실패 시에도 호출되는 정리 함수. 화면 상태가 꼬였으면 새로고침 후 재시도한다.
export async function cleanupMemos(page: Page, titles: string[]) {
  // 상세 보기 모달이 열려 있으면 배경 오버레이가 카드 클릭을 막으므로 먼저 닫는다
  await page.keyboard.press('Escape').catch(() => undefined)
  for (const title of titles) {
    await deleteMemoByTitle(page, title).catch(async () => {
      await page.goto('/')
      await deleteMemoByTitle(page, title)
    })
  }
}
