// Boards are addressed as /quadros/<slug>, but the API works with ids. Ids seen
// in the boards list (or resolved once) are kept here, so opening a board or
// renaming it doesn't need an extra request.
const idsBySlug = new Map<string, string>()

export function rememberBoard(board: { id: string; slug: string }) {
  idsBySlug.set(board.slug, board.id)
}

export function boardIdForSlug(slug: string) {
  return idsBySlug.get(slug)
}

export const boardPath = (slug: string) => `/quadros/${slug}`
