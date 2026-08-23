import { authConfig } from "@/config/auth";

export function isPasswordLongEnough(value: string): boolean {
  return value.trim().length >= authConfig.passwordMinLength;
}

export function passwordsMatch(password: string, confirmation: string): boolean {
  return password === confirmation && password.length > 0;
}

export const PASSWORD_REQUIREMENT_COPY = `رمز عبور حداقل ${authConfig.passwordMinLength} نویسه باشد.`;
