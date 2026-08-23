import Link from "next/link";
import { Card } from "@/components/ui/data-display";
import { Button } from "@/components/ui/button";
import { HomeSection } from "@/features/public/home-section";
import { SectionError } from "@/features/public/section-error";
import { bookingHref } from "@/lib/public/booking-href";
import { telHref } from "@/lib/public/links";
import { displayOrder, formatRange } from "@/lib/public/working-hours";
import type { LoadResult } from "@/lib/api/public";
import type { PublicBranch, PublicBusiness } from "@/types/public";

export function BranchesSection({
  business,
  branches,
}: {
  business: PublicBusiness;
  branches: LoadResult<PublicBranch[]>;
}) {
  if (!business.branchesEnabled) {
    return null;
  }

  if (!branches.ok) {
    return (
      <HomeSection id="branches" title="شعب">
        <SectionError
          title="اطلاعات شعب در دسترس نیست"
          description="آدرس اصلی مجموعه در بخش تماس آمده است."
          requestId={branches.error.requestId}
        />
      </HomeSection>
    );
  }

  if (branches.data.length <= 1) {
    return null;
  }

  return (
    <HomeSection
      id="branches"
      title="شعب"
      description="برای رزرو، شعبه فقط به‌عنوان انتخاب اولیه استفاده می‌شود."
    >
      <ul className="public-card-grid">
        {branches.data.map((branch) => {
          const tel = branch.phone ? telHref(branch.phone) : undefined;
          const hours = displayOrder(branch.workingHours);
          return (
            <li key={branch.id}>
              <Card>
                <h3>{branch.name}</h3>
                {branch.address ? <p>{branch.address}</p> : null}
                {tel ? (
                  <p>
                    <a href={tel} className="ltr-value">
                      تماس با شعبه
                    </a>
                  </p>
                ) : null}
                {hours.length > 0 ? (
                  <p>
                    {hours
                      .slice(0, 3)
                      .map((day) =>
                        day.closed
                          ? `${day.label}: تعطیل`
                          : `${day.label}: ${day.ranges.map(formatRange).join("، ")}`,
                      )
                      .join(" | ")}
                  </p>
                ) : null}
                {business.bookingEnabled ? (
                  <Button asChild size="sm">
                    <Link href={bookingHref({ branchId: branch.id })}>شروع رزرو از این شعبه</Link>
                  </Button>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ul>
    </HomeSection>
  );
}
