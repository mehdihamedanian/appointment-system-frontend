import { Badge } from "@/components/ui/data-display";
import { HomeSection } from "@/features/public/home-section";
import {
  displayOrder,
  formatRange,
  isOpenNow,
  weekdayInTimeZone,
} from "@/lib/public/working-hours";
import type { PublicBusiness } from "@/types/public";

export function HoursSection({ business }: { business: PublicBusiness }) {
  const hours =
    business.contactHours.length > 0 ? business.contactHours : business.workingHours;
  if (hours.length === 0) {
    return null;
  }

  const ordered = displayOrder(hours);
  const today = business.timezone ? weekdayInTimeZone(business.timezone) : null;
  const open = isOpenNow(ordered, business.timezone);

  return (
    <HomeSection
      id="hours"
      title="ساعات کاری"
      description="ساعات کاری به‌معنای خالی بودن نوبت نیست."
    >
      {open === true ? (
        <p>
          <Badge tone="success">اکنون باز است</Badge>
        </p>
      ) : open === false ? (
        <p>
          <Badge tone="neutral">اکنون بسته است</Badge>
        </p>
      ) : null}
      <div className="public-hours" role="region" aria-label="جدول ساعات کاری">
        <table>
          <caption className="visually-hidden">ساعات کاری هفتگی</caption>
          <tbody>
            {ordered.map((day) => (
              <tr key={day.id} data-today={today === day.weekday ? "true" : undefined}>
                <th scope="row">
                  {day.label}
                  {today === day.weekday ? (
                    <Badge tone="primary">امروز</Badge>
                  ) : null}
                  {day.holiday ? <Badge tone="warning">تعطیل ویژه</Badge> : null}
                  {day.special ? <Badge tone="information">ساعت ویژه</Badge> : null}
                </th>
                <td>
                  {day.closed
                    ? "تعطیل"
                    : day.ranges.length > 0
                      ? day.ranges.map(formatRange).join("، ")
                      : "اعلام نشده"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </HomeSection>
  );
}
