// 서버 전용 모듈: Route Handler(`/api/summarize`)에서만 import한다.
// API 키가 브라우저로 노출되지 않도록 클라이언트 코드에서 import 금지.
export const GEMINI_MODEL = 'gemini-3.5-flash-lite'
export const SUMMARY_MAX_INPUT_LENGTH = 8000

const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

const SUMMARY_INSTRUCTION =
  '다음 메모를 한국어로 2~3문장으로 요약하세요. 원문의 언어와 관계없이 한국어로 답하고, 머리말이나 마크다운 서식 없이 요약 본문만 출력하세요.'

const RETRYABLE_STATUSES = [429, 503]
const MAX_ATTEMPTS = 4
const RETRY_BASE_DELAY_MS = 1000

export class GeminiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'GeminiError'
    this.status = status
  }
}

const wait = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms))

interface GeminiResponse {
  candidates?: {
    content?: {
      parts?: { text?: string }[]
    }
  }[]
}

export const geminiUtils = {
  generateSummary: async (content: string, apiKey: string): Promise<string> => {
    const requestInit: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SUMMARY_INSTRUCTION }] },
        contents: [
          {
            parts: [{ text: content.slice(0, SUMMARY_MAX_INPUT_LENGTH) }],
          },
        ],
        generationConfig: { maxOutputTokens: 512 },
      }),
    }

    // 일시적인 과부하(503)와 요청 제한(429)은 대기 후 재시도한다
    let response = await fetch(GEMINI_ENDPOINT, requestInit)
    for (
      let attempt = 1;
      !response.ok &&
      RETRYABLE_STATUSES.includes(response.status) &&
      attempt < MAX_ATTEMPTS;
      attempt++
    ) {
      await wait(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1))
      response = await fetch(GEMINI_ENDPOINT, requestInit)
    }

    if (!response.ok) {
      throw new GeminiError(
        `Gemini 요청에 실패했습니다. (HTTP ${response.status})`,
        response.status
      )
    }

    const data: GeminiResponse = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    if (!text) {
      throw new GeminiError('요약 결과가 비어 있습니다.', 502)
    }
    return text
  },
}
