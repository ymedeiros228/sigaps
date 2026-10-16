/** Prefixo pelo qual o Vercel encaminha a API (vercel.json → /api/*). */
export const API_PREFIX = '/api';

/**
 * Converte a URL que chega na função do Vercel na URL que o Nest conhece:
 * - tira o prefixo /api;
 * - remove o `?path=...` que a regra de rewrite do Vercel acrescenta sozinha
 *   (só quando o valor é o próprio caminho; um `path` legítimo diferente fica).
 * Sem isso, o ValidationPipe (forbidNonWhitelisted) recusaria as consultas.
 */
export function toNestUrl(rawUrl: string | undefined): string {
  const url = rawUrl || '/';
  const queryStart = url.indexOf('?');
  let pathname = queryStart === -1 ? url : url.slice(0, queryStart);
  const search = queryStart === -1 ? '' : url.slice(queryStart + 1);

  if (pathname === API_PREFIX || pathname.startsWith(`${API_PREFIX}/`)) {
    pathname = pathname.slice(API_PREFIX.length) || '/';
  }

  if (!search) return pathname;

  const params = new URLSearchParams(search);
  const injected = params.get('path');
  if (injected !== null && injected === pathname.replace(/^\/+/, '')) {
    params.delete('path');
  }
  const rest = params.toString();
  return rest ? `${pathname}?${rest}` : pathname;
}
