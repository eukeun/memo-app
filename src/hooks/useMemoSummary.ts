'use client'

import { useCallback, useEffect, useState } from 'react'
import { Memo } from '@/types/memo'
import { getMemoSummary, summarizeMemo } from '@/app/actions/memoActions'
import { SUMMARY_MIN_LENGTH } from '@/utils/summaryConfig'

// idle: 요약 대상 아님(짧은 메모), ready: 요약 대기(버튼 클릭 전)
export type SummaryStatus = 'idle' | 'ready' | 'loading' | 'success' | 'error'

interface SummaryState {
  status: SummaryStatus
  summary: string
}

// 페이지가 살아 있는 동안만 유지되는 메모 ID별 캐시 (새로고침 시 소멸)
const summaryCache = new Map<string, { updatedAt: string; summary: string }>()

// 진행 중인 요청 (메모 ID + updatedAt 기준)
const inFlightRequests = new Map<string, Promise<string>>()

export function useMemoSummary(memo: Memo | null) {
  const [state, setState] = useState<SummaryState>({
    status: 'idle',
    summary: '',
  })
  // 사용자가 요약을 요청한 메모 (ID + updatedAt)
  const [requestedKey, setRequestedKey] = useState<string | null>(null)
  const [requestCount, setRequestCount] = useState(0)

  const id = memo?.id
  const content = memo?.content
  const updatedAt = memo?.updatedAt
  const memoKey =
    id !== undefined && updatedAt !== undefined ? `${id}:${updatedAt}` : null

  useEffect(() => {
    if (
      id === undefined ||
      content === undefined ||
      updatedAt === undefined ||
      memoKey === null
    ) {
      setState({ status: 'idle', summary: '' })
      return
    }

    if (content.length < SUMMARY_MIN_LENGTH) {
      setState({ status: 'idle', summary: '' })
      return
    }

    // 이미 생성한 요약은 API 호출 없이 바로 보여 준다
    const cached = summaryCache.get(id)
    if (cached && cached.updatedAt === updatedAt) {
      setState({ status: 'success', summary: cached.summary })
      return
    }

    // 요약하기 버튼을 누르기 전에는 생성하지 않고, DB에 저장된 요약만 조회한다
    if (requestedKey !== memoKey) {
      let isLookupStale = false
      setState({ status: 'idle', summary: '' })
      getMemoSummary(id)
        .catch((error: unknown) => {
          // 조회 실패는 저장된 요약이 없는 것으로 보고 요약하기 버튼을 보여 준다
          console.error('저장된 요약 조회 실패:', error)
          return null
        })
        .then(stored => {
          if (isLookupStale) return
          if (stored) {
            summaryCache.set(id, { updatedAt, summary: stored })
            setState({ status: 'success', summary: stored })
          } else {
            setState({ status: 'ready', summary: '' })
          }
        })
      return () => {
        isLookupStale = true
      }
    }

    // 같은 메모의 진행 중인 요청은 공유한다 (StrictMode의 effect 이중 실행 등 중복 호출 방지)
    let request = inFlightRequests.get(memoKey)
    if (!request) {
      request = summarizeMemo(id)
        .then(result => {
          if (!result.ok) throw new Error(result.error)
          summaryCache.set(id, { updatedAt, summary: result.summary })
          return result.summary
        })
        .finally(() => inFlightRequests.delete(memoKey))
      inFlightRequests.set(memoKey, request)
    }

    // 모달을 닫거나 다른 메모로 바뀐 뒤 도착한 결과는 무시한다
    let isStale = false
    setState({ status: 'loading', summary: '' })

    request
      .then(summary => {
        if (!isStale) setState({ status: 'success', summary })
      })
      .catch((error: unknown) => {
        if (isStale) return
        console.error('메모 요약 실패:', error)
        setState({ status: 'error', summary: '' })
      })

    return () => {
      isStale = true
    }
  }, [id, content, updatedAt, memoKey, requestedKey, requestCount])

  // 요약하기 / 다시 시도 공용: 현재 메모의 요약을 요청한다
  const summarize = useCallback(() => {
    setRequestedKey(memoKey)
    setRequestCount(count => count + 1)
  }, [memoKey])

  return { status: state.status, summary: state.summary, summarize }
}
