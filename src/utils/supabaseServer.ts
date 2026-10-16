// 서버 전용 모듈: Server Action(`src/app/actions/*`)에서만 import한다.
// 클라이언트 코드(컴포넌트, 훅)에서 import 금지.
import { createClient, SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export const getSupabase = (): SupabaseClient => {
  if (client) return client

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL 또는 SUPABASE_PUBLISHABLE_KEY가 설정되지 않았습니다.'
    )
  }

  client = createClient(url, key, { auth: { persistSession: false } })
  return client
}
