export type Notice = {
  id: number
  message: string
  action?: { label: string; onClick: () => void }
}

let lastId = 0

/** Builds a toast message with a fresh id; a new id also restarts the toast's timer. */
export function makeNotice(message: string, action?: Notice['action']): Notice {
  lastId += 1
  return { id: lastId, message, action }
}
