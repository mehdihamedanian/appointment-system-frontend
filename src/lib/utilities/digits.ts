const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function normalizeDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (char) => {
    const persian = PERSIAN_DIGITS.indexOf(char);
    if (persian >= 0) {
      return String(persian);
    }
    const arabic = ARABIC_DIGITS.indexOf(char);
    return arabic >= 0 ? String(arabic) : char;
  });
}

export function toLatinPhone(value: string): string {
  return normalizeDigits(value).replace(/[^\d+]/g, "");
}
