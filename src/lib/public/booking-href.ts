export function isSafePublicId(value: string | null | undefined): value is string {
  return Boolean(value && /^[A-Za-z0-9_-]{1,80}$/.test(value));
}

export function bookingHref(input?: {
  serviceId?: string;
  providerId?: string;
  branchId?: string;
  repeatFrom?: string;
}): string {
  const url = new URL("/booking", "http://localhost");
  if (isSafePublicId(input?.serviceId)) {
    url.searchParams.set("service", input.serviceId);
  }
  if (isSafePublicId(input?.providerId)) {
    url.searchParams.set("provider", input.providerId);
  }
  if (isSafePublicId(input?.branchId)) {
    url.searchParams.set("branch", input.branchId);
  }
  if (isSafePublicId(input?.repeatFrom) && !/^\d+$/.test(input.repeatFrom)) {
    url.searchParams.set("repeatFrom", input.repeatFrom);
  }
  return `${url.pathname}${url.search}`;
}
