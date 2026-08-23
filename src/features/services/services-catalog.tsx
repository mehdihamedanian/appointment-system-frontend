"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EmptyState, NoResultsState } from "@/components/feedback/app-states";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/form-field";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { ServiceCard } from "@/features/services/service-card";
import { telHref } from "@/lib/public/links";
import {
  catalogCategories,
  filterServiceCatalog,
  sanitizeCategoryParam,
  sanitizeServiceQuery,
} from "@/lib/public/service-search";
import type { ServiceCatalogView } from "@/types/service";

const SEARCH_DEBOUNCE_MS = 300;

export function ServicesCatalog({
  catalog,
  bookingEnabled,
  phone,
}: {
  catalog: ServiceCatalogView;
  bookingEnabled: boolean;
  phone?: string;
}) {
  const searchParams = useSearchParams();
  const urlQuery = sanitizeServiceQuery(searchParams.get("q")) ?? "";
  const categoryParam = searchParams.get("category") ?? "";
  return (
    <ServicesCatalogFields
      key={`${urlQuery}:${categoryParam}`}
      catalog={catalog}
      bookingEnabled={bookingEnabled}
      phone={phone}
      urlQuery={urlQuery}
      categoryParam={categoryParam}
    />
  );
}

function ServicesCatalogFields({
  catalog,
  bookingEnabled,
  phone,
  urlQuery,
  categoryParam,
}: {
  catalog: ServiceCatalogView;
  bookingEnabled: boolean;
  phone?: string;
  urlQuery: string;
  categoryParam: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const categories = catalogCategories(catalog.items);
  const showCategoryFilter = categories.length >= 2;
  const allowedIds = categories.map((item) => item.id);
  const urlCategory = showCategoryFilter
    ? sanitizeCategoryParam(categoryParam, allowedIds)
    : undefined;

  const [draft, setDraft] = useState(urlQuery);
  const [, startTransition] = useTransition();

  const replaceFilters = useCallback(
    (nextQuery?: string, nextCategory?: string) => {
      const params = new URLSearchParams();
      if (nextQuery) {
        params.set("q", nextQuery);
      }
      if (nextCategory) {
        params.set("category", nextCategory);
      }
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [pathname, router, startTransition],
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = sanitizeServiceQuery(draft);
      if ((next ?? "") === urlQuery) {
        return;
      }
      replaceFilters(next, urlCategory);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [draft, replaceFilters, urlCategory, urlQuery]);

  const effectiveQuery = catalog.paginated ? urlQuery : sanitizeServiceQuery(draft);
  const visible = filterServiceCatalog(catalog, {
    q: effectiveQuery,
    category: urlCategory,
  });

  const hasActiveFilters = Boolean(effectiveQuery || urlCategory);
  const tel = phone ? telHref(phone) : undefined;

  function clearAll() {
    setDraft("");
    replaceFilters(undefined, undefined);
  }

  if (catalog.items.length === 0) {
    return (
      <EmptyState
        title="خدمتی برای نمایش نیست"
        description="فعلاً خدمت عمومی برای این مجموعه ثبت نشده است."
        action={
          tel ? (
            <Button asChild variant="secondary">
              <a href={tel}>تماس با مجموعه</a>
            </Button>
          ) : null
        }
      />
    );
  }

  return (
    <div className="services-catalog">
      <form
        className="services-toolbar"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          replaceFilters(sanitizeServiceQuery(draft), urlCategory);
        }}
      >
        <div className="services-toolbar__search">
          <Label htmlFor="service-search">جستجوی خدمات</Label>
          <SearchInput
            id="service-search"
            name="q"
            value={draft}
            placeholder="نام خدمت"
            onChange={(event) => setDraft(event.target.value)}
            onClear={() => {
              setDraft("");
              replaceFilters(undefined, urlCategory);
            }}
          />
        </div>
        {showCategoryFilter ? (
          <div className="services-toolbar__filter">
            <Label htmlFor="service-category">دسته‌بندی</Label>
            <Select
              id="service-category"
              value={urlCategory}
              allowClear
              placeholder="همه دسته‌ها"
              options={categories.map((item) => ({ value: item.id, label: item.name }))}
              onChange={(value) => replaceFilters(effectiveQuery, value)}
            />
          </div>
        ) : null}
      </form>

      <p className="text-caption" aria-live="polite">
        {visible.length} خدمت
        {effectiveQuery ? ` برای «${effectiveQuery}»` : ""}
      </p>

      {visible.length === 0 ? (
        <NoResultsState
          title="نتیجه‌ای پیدا نشد"
          description="عبارت یا دسته دیگری را امتحان کنید."
          action={
            hasActiveFilters ? (
              <Button variant="secondary" onClick={clearAll}>
                پاک کردن جستجو
              </Button>
            ) : null
          }
        />
      ) : (
        <ul className="public-card-grid">
          {visible.map((service, index) => (
            <li key={service.id}>
              <ServiceCard
                service={service}
                bookingEnabled={bookingEnabled}
                priority={index === 0 && !hasActiveFilters}
                headingLevel="h2"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
