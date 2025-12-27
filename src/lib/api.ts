// centraliza a base dos webhooks
export const WEBHOOK_BASE = 'https://auto.graueducacionalmossoro.com.br/webhook/';

export function webhook(path: string) {
  if (!path) return WEBHOOK_BASE;
  const p = path.startsWith('/') ? path.slice(1) : path;
  return `${WEBHOOK_BASE}${p}`;
}
