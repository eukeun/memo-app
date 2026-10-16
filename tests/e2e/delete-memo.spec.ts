import { test, expect } from '@playwright/test'
import {
  cleanupMemos,
  createMemoViaUi,
  gotoAndWaitForList,
  memoCard,
  readTotal,
  uniqueTitle,
} from './helpers/memoHelpers'

// 시나리오: tests/e2e/scenarios/delete-memo.md (P1, 메모 삭제)

const CONFIRM_MESSAGE = '정말로 이 메모를 삭제하시겠습니까?'

test.describe('메모 삭제', () => {
  test('삭제를 수락하면 목록에서 사라지고 새로고침 후에도 없다', async ({
    page,
  }) => {
    const title = uniqueTitle('E2E 삭제 테스트')

    try {
      await gotoAndWaitForList(page)
      await createMemoViaUi(page, { title, content: '삭제될 메모 본문' })
      const totalBefore = await readTotal(page)

      const dialogMessages: string[] = []
      page.once('dialog', dialog => {
        dialogMessages.push(dialog.message())
        void dialog.accept()
      })
      await memoCard(page, title).getByRole('button', { name: '삭제' }).click()

      await expect(memoCard(page, title)).toHaveCount(0)
      expect(dialogMessages).toEqual([CONFIRM_MESSAGE])
      await expect(
        page.getByText(`총 ${totalBefore - 1}개의 메모`)
      ).toBeVisible()
      await expect(page.getByTestId('memo-error')).toHaveCount(0)

      // 새로고침 후에도 없다 (DB에서 삭제됨)
      await page.reload()
      await expect(page.getByTestId('memo-card').first()).toBeVisible()
      await expect(memoCard(page, title)).toHaveCount(0)
      await expect(
        page.getByText(`총 ${totalBefore - 1}개의 메모`)
      ).toBeVisible()
    } finally {
      await cleanupMemos(page, [title])
    }
  })

  test('삭제 확인을 취소하면 메모와 개수가 유지된다', async ({ page }) => {
    const title = uniqueTitle('E2E 삭제 취소')

    try {
      await gotoAndWaitForList(page)
      await createMemoViaUi(page, { title, content: '유지될 메모 본문' })
      const totalBefore = await readTotal(page)

      page.once('dialog', dialog => {
        void dialog.dismiss()
      })
      await memoCard(page, title).getByRole('button', { name: '삭제' }).click()

      await expect(memoCard(page, title)).toHaveCount(1)
      await expect(page.getByText(`총 ${totalBefore}개의 메모`)).toBeVisible()
    } finally {
      await cleanupMemos(page, [title])
    }
  })
})
