import { test, expect, Page } from '@playwright/test'

// 시나리오: tests/e2e/scenarios/create-memo.md (P0, 새 메모 작성)
// 앱은 실제 Supabase DB를 사용하므로, 테스트가 만든 메모는 finally에서 반드시 삭제한다.

const TOTAL_TEXT = /총 (\d+)개의 메모/

async function gotoAndWaitForList(page: Page) {
  await page.goto('/')
  await expect(page.getByTestId('memo-card').first()).toBeVisible()
}

async function readTotal(page: Page): Promise<number> {
  const label = page.getByText(TOTAL_TEXT)
  await expect(label).toBeVisible()
  const text = (await label.textContent()) ?? ''
  const match = text.match(TOTAL_TEXT)
  if (!match) throw new Error(`메모 개수 텍스트를 읽지 못했습니다: "${text}"`)
  return Number(match[1])
}

async function openNewMemoForm(page: Page) {
  await page.getByRole('button', { name: '새 메모' }).click()
  await expect(
    page.getByRole('heading', { name: '새 메모 작성' })
  ).toBeVisible()
}

// 고유 제목의 카드만 삭제한다 (목업 메모는 건드리지 않는다)
async function deleteMemoByTitle(page: Page, title: string) {
  const cards = page.getByTestId('memo-card').filter({ hasText: title })
  const before = await cards.count()
  if (before === 0) return
  page.once('dialog', dialog => dialog.accept())
  await cards.first().getByTitle('삭제').click()
  await expect(cards).toHaveCount(before - 1)
}

test.describe('새 메모 작성', () => {
  test('새 메모를 작성하면 목록에 추가되고 새로고침 후에도 유지된다', async ({
    page,
  }) => {
    const title = `E2E 작성 테스트 ${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 6)}`
    const content = 'E2E로 작성한 메모 본문'

    try {
      await gotoAndWaitForList(page)
      const initialTotal = await readTotal(page)

      await openNewMemoForm(page)
      await page.getByRole('textbox', { name: '제목 *' }).fill(title)
      await page.getByRole('combobox', { name: '카테고리' }).selectOption({
        label: '업무',
      })
      // MDEditor는 dynamic import이므로 textarea가 나타날 때까지 auto-wait
      const editor = page
        .getByTestId('memo-content-editor')
        .getByRole('textbox', { name: '내용 * (마크다운 지원)' })
      await editor.fill(content)
      const tagInput = page.getByPlaceholder('태그를 입력하고 Enter를 누르세요')
      await tagInput.fill('e2e')
      await tagInput.press('Enter')
      await expect(page.getByText('#e2e')).toBeVisible()

      await page.getByRole('button', { name: '저장하기' }).click()

      // 모달이 닫힌다
      await expect(
        page.getByRole('heading', { name: '새 메모 작성' })
      ).toHaveCount(0)

      // 카드 확인: 제목, 카테고리 배지, 태그
      const card = page.getByTestId('memo-card').filter({ hasText: title })
      await expect(card).toHaveCount(1)
      await expect(card.getByText('업무', { exact: true })).toBeVisible()
      await expect(card.getByText('#e2e')).toBeVisible()
      await expect(card).toContainText(content)

      // 개수 +1, 오류 배너 없음
      await expect(
        page.getByText(`총 ${initialTotal + 1}개의 메모`)
      ).toBeVisible()
      await expect(page.getByTestId('memo-error')).toHaveCount(0)

      // 새로고침 후에도 유지 (DB 영속화)
      await page.reload()
      await expect(
        page.getByTestId('memo-card').filter({ hasText: title })
      ).toHaveCount(1)
      await expect(
        page.getByText(`총 ${initialTotal + 1}개의 메모`)
      ).toBeVisible()
      await expect(page.getByTestId('memo-error')).toHaveCount(0)
    } finally {
      // 실패해도 항상 정리
      await deleteMemoByTitle(page, title).catch(async () => {
        await page.goto('/')
        await deleteMemoByTitle(page, title)
      })
    }
  })

  test('제목을 비우고 저장하면 모달이 유지되고 개수가 변하지 않는다', async ({
    page,
  }) => {
    await gotoAndWaitForList(page)
    const initialTotal = await readTotal(page)

    await openNewMemoForm(page)
    await page
      .getByTestId('memo-content-editor')
      .getByRole('textbox', { name: '내용 * (마크다운 지원)' })
      .fill('제목 없는 본문')
    await page.getByRole('button', { name: '저장하기' }).click()

    // 브라우저 필수 입력 검증으로 제출이 막힌다
    const titleInput = page.getByRole('textbox', { name: '제목 *' })
    await expect
      .poll(() =>
        titleInput.evaluate((el: HTMLInputElement) => el.validity.valueMissing)
      )
      .toBe(true)
    await expect(
      page.getByRole('heading', { name: '새 메모 작성' })
    ).toBeVisible()

    await page.getByRole('button', { name: '취소' }).click()
    await expect(
      page.getByRole('heading', { name: '새 메모 작성' })
    ).toHaveCount(0)
    await expect(page.getByText(`총 ${initialTotal}개의 메모`)).toBeVisible()
    await expect(page.getByTestId('memo-error')).toHaveCount(0)
  })

  test('내용을 비우고 저장하면 안내 alert가 뜨고 모달이 유지된다', async ({
    page,
  }) => {
    const title = `E2E 빈 내용 ${Date.now()}`
    await gotoAndWaitForList(page)
    const initialTotal = await readTotal(page)

    // 내용 필드에는 required가 없어 앱의 alert 검증이 동작한다
    const dialogMessages: string[] = []
    page.on('dialog', dialog => {
      dialogMessages.push(dialog.message())
      void dialog.accept()
    })

    await openNewMemoForm(page)
    await page.getByRole('textbox', { name: '제목 *' }).fill(title)
    await page.getByRole('button', { name: '저장하기' }).click()

    await expect
      .poll(() => dialogMessages)
      .toContain('제목과 내용을 모두 입력해주세요.')
    await expect(
      page.getByRole('heading', { name: '새 메모 작성' })
    ).toBeVisible()

    await page.getByRole('button', { name: '취소' }).click()
    await expect(page.getByText(`총 ${initialTotal}개의 메모`)).toBeVisible()
    await expect(
      page.getByTestId('memo-card').filter({ hasText: title })
    ).toHaveCount(0)
  })
})
