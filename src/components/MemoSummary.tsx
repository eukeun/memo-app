'use client'

import { useState } from 'react'
import { Memo } from '@/types/memo'
import { useMemoSummary } from '@/hooks/useMemoSummary'

interface MemoSummaryProps {
  memo: Memo
}

export default function MemoSummary({ memo }: MemoSummaryProps) {
  const { status, summary, summarize } = useMemoSummary(memo)
  const [isHidden, setIsHidden] = useState(false)

  if (status === 'idle') return null

  return (
    <div
      className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg"
      data-testid="memo-summary"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-blue-700">AI 요약</span>
        <button
          onClick={() => setIsHidden(prev => !prev)}
          aria-label={isHidden ? 'AI 요약 표시' : 'AI 요약 숨기기'}
          aria-expanded={!isHidden}
          className="text-xs text-gray-500 hover:text-gray-700"
          data-testid="memo-summary-toggle-btn"
        >
          {isHidden ? '표시' : '숨기기'}
        </button>
      </div>

      {!isHidden && (
        <div className="mt-2 text-sm text-gray-700">
          {status === 'ready' && (
            <button
              onClick={summarize}
              className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors"
              data-testid="memo-summary-start-btn"
            >
              요약하기
            </button>
          )}
          {status === 'loading' && (
            <div
              className="flex items-center gap-2 text-gray-500"
              data-testid="memo-summary-loading"
            >
              <span className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
              요약 중...
            </div>
          )}
          {status === 'error' && (
            <div
              className="flex items-center justify-between gap-2"
              data-testid="memo-summary-error"
            >
              <span className="text-red-600">요약을 불러오지 못했습니다.</span>
              <button
                onClick={summarize}
                className="px-2 py-1 text-xs border border-gray-300 rounded-md hover:bg-white"
                data-testid="memo-summary-retry-btn"
              >
                다시 시도
              </button>
            </div>
          )}
          {status === 'success' && (
            <p className="break-words" data-testid="memo-summary-text">
              {summary}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
