export type TextDirection = "rtl" | "ltr";

export const localeConfig = {
  defaultLanguage: "fa",
  defaultDirection: "rtl" as TextDirection,
  fallbackFont: "Tahoma, sans-serif",
} as const;

export function getDocumentLocale(): {
  lang: string;
  dir: TextDirection;
} {
  return {
    lang: localeConfig.defaultLanguage,
    dir: localeConfig.defaultDirection,
  };
}
