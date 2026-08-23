import { toLatinPhone } from "@/lib/utilities/digits";

export function normalizeIranMobile(value: string): string {
  let digits = toLatinPhone(value).replace(/^\+/, "");
  if (digits.startsWith("98") && digits.length >= 12) {
    digits = `0${digits.slice(2)}`;
  }
  if (digits.startsWith("9") && digits.length === 10) {
    digits = `0${digits}`;
  }
  return digits;
}

export function isValidIranMobile(value: string): boolean {
  return /^09\d{9}$/.test(normalizeIranMobile(value));
}

export function maskPhone(value: string): string {
  const phone = normalizeIranMobile(value);
  if (phone.length < 7) {
    return phone;
  }
  return `${phone.slice(0, 4)}***${phone.slice(-2)}`;
}
