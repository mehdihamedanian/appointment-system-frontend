export function isPresent(value: string | null | undefined): value is string {
  return Boolean(value && value.trim().length > 0);
}
