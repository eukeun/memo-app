'use server'

import { v4 as uuidv4 } from 'uuid'
import { Memo, MemoFormData } from '@/types/memo'
import { GeminiError, geminiUtils } from '@/utils/gemini'
import { getSupabase } from '@/utils/supabaseServer'

export type SummaryResult =
  | { ok: true; summary: string }
  | { ok: false; error: string }

interface MemoRow {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
  created_at: string
  updated_at: string
}

const toMemo = (row: MemoRow): Memo => ({
  id: row.id,
  title: row.title,
  content: row.content,
  category: row.category,
  tags: row.tags,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
})

const toFormRow = (formData: MemoFormData) => ({
  title: formData.title,
  content: formData.content,
  category: formData.category,
  tags: formData.tags,
})

export async function getMemos(): Promise<Memo[]> {
  const { data, error } = await getSupabase()
    .from('memos')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('메모 조회 실패:', error)
    throw new Error('메모를 불러오지 못했습니다.')
  }
  return (data as MemoRow[]).map(toMemo)
}

export async function createMemo(formData: MemoFormData): Promise<Memo> {
  const { data, error } = await getSupabase()
    .from('memos')
    .insert({ id: uuidv4(), ...toFormRow(formData) })
    .select()
    .single()

  if (error) {
    console.error('메모 생성 실패:', error)
    throw new Error('메모를 저장하지 못했습니다.')
  }
  return toMemo(data as MemoRow)
}

export async function updateMemo(
  id: string,
  formData: MemoFormData
): Promise<Memo> {
  const { data, error } = await getSupabase()
    .from('memos')
    .update(toFormRow(formData))
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('메모 수정 실패:', error)
    throw new Error('메모를 수정하지 못했습니다.')
  }
  return toMemo(data as MemoRow)
}

export async function deleteMemo(id: string): Promise<void> {
  const { error } = await getSupabase().from('memos').delete().eq('id', id)

  if (error) {
    console.error('메모 삭제 실패:', error)
    throw new Error('메모를 삭제하지 못했습니다.')
  }
}

export async function deleteAllMemos(): Promise<void> {
  // 조건 없는 delete는 거부되므로 항상 참인 조건을 지정한다
  const { error } = await getSupabase()
    .from('memos')
    .delete()
    .not('id', 'is', null)

  if (error) {
    console.error('전체 메모 삭제 실패:', error)
    throw new Error('메모를 삭제하지 못했습니다.')
  }
}

// 저장된 요약 조회. 메모가 요약 이후 수정되었으면(updated_at 불일치) 없는 것으로 본다.
const findStoredSummary = async (
  id: string
): Promise<{ summary: string | null; content: string | null }> => {
  const supabase = getSupabase()
  const { data: memo, error: memoError } = await supabase
    .from('memos')
    .select('content, updated_at')
    .eq('id', id)
    .maybeSingle()

  if (memoError) throw memoError
  if (!memo) return { summary: null, content: null }

  const { data: stored, error: summaryError } = await supabase
    .from('memo_summaries')
    .select('summary')
    .eq('memo_id', id)
    .eq('memo_updated_at', memo.updated_at)
    .maybeSingle()

  if (summaryError) throw summaryError
  return { summary: stored?.summary ?? null, content: memo.content }
}

// 요약 생성 없이 저장된 요약만 조회
export async function getMemoSummary(id: string): Promise<string | null> {
  try {
    return (await findStoredSummary(id)).summary
  } catch (error: unknown) {
    console.error('요약 조회 실패:', error)
    return null
  }
}

// 저장된 요약이 있으면 반환하고, 없으면 Gemini로 생성해 저장한다
export async function summarizeMemo(id: string): Promise<SummaryResult> {
  try {
    const { summary: stored, content } = await findStoredSummary(id)
    if (stored) return { ok: true, summary: stored }
    if (content === null || content.trim() === '') {
      return { ok: false, error: '요약할 내용이 없습니다.' }
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.error('GEMINI_API_KEY가 설정되지 않았습니다.')
      return { ok: false, error: 'Gemini API 키가 설정되지 않았습니다.' }
    }

    const supabase = getSupabase()
    const { data: memo, error: memoError } = await supabase
      .from('memos')
      .select('updated_at')
      .eq('id', id)
      .single()
    if (memoError) throw memoError

    const summary = await geminiUtils.generateSummary(content, apiKey)

    // 생성 중 메모가 수정되었어도 요약은 생성 시점의 updated_at에 묶여 이후 무효 처리된다
    const { error: upsertError } = await supabase
      .from('memo_summaries')
      .upsert({
        memo_id: id,
        summary,
        memo_updated_at: memo.updated_at,
      })
    if (upsertError) console.error('요약 저장 실패:', upsertError)

    return { ok: true, summary }
  } catch (error: unknown) {
    console.error('메모 요약 실패:', error)
    const message =
      error instanceof GeminiError
        ? `요약을 생성하지 못했습니다. (${error.status})`
        : '요약을 생성하지 못했습니다.'
    return { ok: false, error: message }
  }
}
