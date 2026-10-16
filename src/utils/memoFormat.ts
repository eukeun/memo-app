const CATEGORY_COLORS: Record<string, string> = {
  personal: 'bg-blue-100 text-blue-800',
  work: 'bg-green-100 text-green-800',
  study: 'bg-purple-100 text-purple-800',
  idea: 'bg-yellow-100 text-yellow-800',
  other: 'bg-gray-100 text-gray-800',
}

// Tailwind preflight가 제거한 마크다운 목록 스타일(불릿/번호) 복원
export const MARKDOWN_LIST_CLASS =
  '[&_ul]:list-disc [&_ol]:list-decimal [&_ul_ul]:list-[circle]'

// 카드 미리보기용: 마크다운 기호를 제거한 일반 텍스트 반환
export const stripMarkdown = (markdown: string): string =>
  markdown
    .replace(/^\s*(```|~~~).*$/gm, '') // 코드 펜스 (내용은 유지)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // 이미지 -> alt
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 링크 -> 텍스트
    .replace(/<\/?[a-zA-Z][^>]*>/g, '') // HTML 태그
    .replace(/^\s{0,3}#{1,6}\s+/gm, '') // 제목
    .replace(/^\s{0,3}>\s?/gm, '') // 인용
    .replace(/^\s*([-*_]\s*){3,}$/gm, '') // 구분선
    .replace(/^\s*[-*+]\s+(\[[ xX]\]\s+)?/gm, '') // 순서 없는 목록/체크박스
    .replace(/^\s*\d+[.)]\s+/gm, '') // 순서 있는 목록
    .replace(/^\s*\|?[\s:|-]+\|[\s:|-]*$/gm, '') // 표 구분 행
    .replace(/\|/g, ' ') // 표 셀 구분자
    .replace(/\*\*(.+?)\*\*/g, '$1') // 굵게
    .replace(/(^|\W)__(.+?)__(?=\W|$)/g, '$1$2') // 굵게 (밑줄)
    .replace(/\*(.+?)\*/g, '$1') // 기울임
    .replace(/(^|\W)_(.+?)_(?=\W|$)/g, '$1$2') // 기울임 (밑줄)
    .replace(/~~(.+?)~~/g, '$1') // 취소선
    .replace(/`([^`]*)`/g, '$1') // 인라인 코드
    .replace(/\s+/g, ' ')
    .trim()

export const formatMemoDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const getCategoryColor = (category: string): string =>
  CATEGORY_COLORS[category] || CATEGORY_COLORS.other
