/** CPF interno gerado quando o cadastro manual não informa documento. */
const INTERNAL_PREFIX = '000';

export function isInternalAcsCode(cpf: string | null | undefined): boolean {
  const digits = (cpf ?? '').replace(/\D/g, '');
  return digits.length === 11 && digits.startsWith(INTERNAL_PREFIX);
}

export function generateInternalAcsCode(): string {
  const ts = Date.now().toString().slice(-7);
  const rand = Math.floor(Math.random() * 10_000)
    .toString()
    .padStart(4, '0');
  return `${INTERNAL_PREFIX}${ts}${rand}`.slice(0, 11);
}
