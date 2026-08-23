let resetToken: string | null = null;

export function stashResetToken(token: string): void {
  resetToken = token;
}

export function consumeResetToken(): string | null {
  const value = resetToken;
  resetToken = null;
  return value;
}
