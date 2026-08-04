/** 后端 JSONB content（JSON 文本）→ 可读文本；非字符串 JSON 反序列化后 pretty-print；非 JSON 原样。 */
export function displayContent(raw: string): string {
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2);
  } catch {
    return raw;
  }
}

/** 把 textarea 文本包装成合法 JSON 字符串存 JSONB（纯文本也能存）。 */
export function wrapContent(text: string): string {
  return JSON.stringify(text);
}
