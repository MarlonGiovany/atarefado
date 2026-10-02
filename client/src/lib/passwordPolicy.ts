// Mirrors the server's rules (server/src/lib/passwords.ts) for instant feedback;
// the server stays the source of truth and also blocks very common passwords.
export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 64

export const PASSWORD_HINT =
  'Use pelo menos 8 caracteres. Frases longas são ótimas; senhas muito comuns não são aceitas.'

/** Returns an error message, or null when the password looks acceptable. */
export function checkPassword(password: string): string | null {
  const length = [...password].length
  if (length === 0) return 'Digite uma senha.'
  if (length < PASSWORD_MIN_LENGTH) return `A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`
  if (length > PASSWORD_MAX_LENGTH) return `A senha pode ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`
  return null
}
