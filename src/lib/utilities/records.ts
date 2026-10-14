export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

export function readNestedRecord(
  value: unknown,
  key: string,
): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const nested = value[key];
  return isRecord(nested) ? nested : undefined;
}

function toSnakeKey(key: string): string {
  return key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
}

/** Reads camelCase or snake_case aliases from a Backend/UI payload. */
export function readField(source: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) {
      return source[key];
    }
    const snake = toSnakeKey(key);
    if (snake !== key && source[snake] !== undefined && source[snake] !== null) {
      return source[snake];
    }
  }
  return undefined;
}

export function readFieldString(
  source: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  return readString(readField(source, ...keys));
}
