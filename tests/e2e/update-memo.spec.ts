import { test, expect } from '@playwright/test'
import {
  cleanupMemos,
  contentEditor,
  createMemoViaUi,
  gotoAndWaitForList,
  memoCard,
  readTotal,
  uniqueTitle,
} from './helpers/memoHelpers'

// 시나리오: tests/e2e/scenarios/update-memo.md (P1, 메모 수정)

test.describe('메모 수정', () => {
  test('메모를 수정하면 카드에 반영되고 새로고침 후에도 유지된다', async ({
    page,
  }) => {
    const title = uniqueTitle('E2E 수정 테스트')
    const newTitle = `${title} (수정됨)`
    const newContent = '수정 후 본문'

    try {
      await gotoAndWaitForList(page)
      await createMemoViaUi(page, {
        title,
        content: '수정 전 본문',
        category: '개인',
      })
      const totalBefore = await readTotal(page)

      await memoCard(page, title).getByRole('button', { name: '편집' }).click()

      // 편집 모달에 기존 값이 채워져 있다
      await expect(
        page.getByRole('heading', { name: '메모 편집' })
      ).toBeVisible()
      await expect(page.getByRole('textbox', { name: '제목 *' })).toHaveValue(
        title
      )
      await expect(
        page.getByRole('combobox', { name: '카테고리' })
      ).toHaveValue('personal')
      await expect(contentEditor(page)).toHaveValue('수정 전 본문')

      await page.getByRole('textbox', { name: '제목 *' }).fill(newTitle)
      await page
        .getByRole('combobox', { name: '카테고리' })
        .selectOption({ label: '학습' })
      await contentEditor(page).fill(newContent)
      await page.getByRole('button', { name: '수정하기' }).click()

      await expect(
        page.getByRole('heading', { name: '메모 편집' })
      ).toHaveCount(0)

      // 카드: 새 제목·배지, 이전 제목 없음, 개수 불변
      const card = memoCard(page, newTitle)
      await expect(card).toHaveCount(1)
      await expect(card.getByText('학습', { exact: true })).toBeVisible()
      await expect(card).toContainText(newContent)
      await expect(page.getByText(`총 ${totalBefore}개의 메모`)).toBeVisible()
      await expect(page.getByTestId('memo-error')).toHaveCount(0)

      // 상세 보기에서 수정된 내용 확인
      await card.click()
      const viewer = page.getByTestId('memo-viewer')
      await expect(viewer).toBeVisible()
      await expect(viewer.getByTestId('memo-viewer-content')).toContainText(
        newContent
      )
      await expect(viewer).toContainText('수정:')
      await page.getByTestId('memo-viewer-close-btn').click()
      await expect(viewer).toHaveCount(0)

      // 새로고침 후에도 유지 (DB 영속화)
      await page.reload()
      await expect(memoCard(page, newTitle)).toHaveCount(1)
      await expect(memoCard(page, newTitle)).toContainText(newContent)
    } finally {
      await cleanupMemos(page, [newTitle, title])
    }
  })

  test('편집 중 취소하면 카드 내용이 바뀌지 않는다', async ({ page }) => {
    const title = uniqueTitle('E2E 수정 취소')

    try {
      await gotoAndWaitForList(page)
      await createMemoViaUi(page, { title, content: '취소 전 본문' })

      await memoCard(page, title).getByRole('button', { name: '편집' }).click()
      await page
        .getByRole('textbox', { name: '제목 *' })
        .fill(`${title} (바뀌면 안 됨)`)
      await page.getByRole('button', { name: '취소' }).click()

      await expect(
        page.getByRole('heading', { name: '메모 편집' })
      ).toHaveCount(0)
      await expect(memoCard(page, title)).toHaveCount(1)
      await expect(memoCard(page, '(바뀌면 안 됨)')).toHaveCount(0)
    } finally {
      await cleanupMemos(page, [title])
    }
  })
})
