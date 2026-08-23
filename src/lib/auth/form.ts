export function focusField(id: string): void {
  const node = document.getElementById(id);
  if (node instanceof HTMLElement) {
    node.focus();
  }
}

export function safeFieldMessage(message: string | undefined): string {
  if (!message) {
    return "این مقدار معتبر نیست.";
  }
  if (/exception|stack|trace|sql|prisma|token|otp/i.test(message)) {
    return "این مقدار معتبر نیست.";
  }
  return message;
}

export function pickFieldError(
  fieldErrors: Record<string, string[]> | undefined,
  keys: string[],
): string | undefined {
  if (!fieldErrors) {
    return undefined;
  }
  for (const key of keys) {
    const message = fieldErrors[key]?.[0];
    if (message) {
      return safeFieldMessage(message);
    }
  }
  return undefined;
}
