/** GSM-7 basic character set (approximate). Non-GSM chars force Unicode encoding. */
const GSM7_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";

const GSM7_EXTENDED = "^{}\\[~]|€";

export type SmsLengthEstimate = {
  characterCount: number;
  encoding: "gsm7" | "unicode";
  segmentCount: number;
  singleSegmentLimit: number;
  multiSegmentLimit: number;
  label: string;
};

function isGsm7Char(char: string): boolean {
  return GSM7_BASIC.includes(char) || GSM7_EXTENDED.includes(char);
}

function isGsm7(text: string): boolean {
  for (const char of text) {
    if (!isGsm7Char(char)) return false;
  }
  return true;
}

/** Client-side SMS segment estimate — Backend value takes precedence when provided. */
export function estimateSmsLength(text: string): SmsLengthEstimate {
  const characterCount = [...text].length;
  const encoding = isGsm7(text) ? "gsm7" : "unicode";
  const singleSegmentLimit = encoding === "gsm7" ? 160 : 70;
  const multiSegmentLimit = encoding === "gsm7" ? 153 : 67;

  let segmentCount = 1;
  if (characterCount === 0) {
    segmentCount = 0;
  } else if (characterCount > singleSegmentLimit) {
    segmentCount = Math.ceil(characterCount / multiSegmentLimit);
  }

  const encodingLabel = encoding === "gsm7" ? "GSM-7" : "Unicode";
  const label =
    segmentCount <= 1
      ? `${characterCount} کاراکتر · ${encodingLabel}`
      : `${characterCount} کاراکتر · ${segmentCount} پیامک · ${encodingLabel}`;

  return {
    characterCount,
    encoding,
    segmentCount,
    singleSegmentLimit,
    multiSegmentLimit,
    label,
  };
}

export function extractTemplateTokens(text: string): string[] {
  const matches = text.match(/\{\{[a-zA-Z0-9_.]+\}\}/g) ?? [];
  return [...new Set(matches.map((token) => token.slice(2, -2)))];
}

export function findUnknownTemplateTokens(
  text: string,
  allowedTokens: string[],
): string[] {
  const allowed = new Set(allowedTokens);
  return extractTemplateTokens(text).filter((token) => !allowed.has(token));
}

export function insertTokenAtCursor(
  textarea: HTMLTextAreaElement,
  token: string,
  wrapped = true,
): string {
  const insert = wrapped ? `{{${token}}}` : token;
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? start;
  const next = `${textarea.value.slice(0, start)}${insert}${textarea.value.slice(end)}`;
  const cursor = start + insert.length;
  window.requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(cursor, cursor);
  });
  return next;
}
