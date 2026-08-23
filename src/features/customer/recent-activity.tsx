import { Card } from "@/components/ui/data-display";
import { formatRelativeTime } from "@/lib/date-time/format";
import type { ActivityPreview } from "@/types/customer";

export function RecentActivityList({ activities }: { activities: ActivityPreview[] }) {
  if (activities.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="dashboard-activity-title">
      <Card>
        <h2 id="dashboard-activity-title" className="text-card-title">
          فعالیت‌های اخیر
        </h2>
        <ol className="dashboard-activity">
          {activities.map((item) => {
            const when = formatRelativeTime(item.createdAt);
            return (
              <li key={item.id}>
                <p>{item.title}</p>
                {when ? (
                  <time dateTime={item.createdAt} className="text-caption">
                    {when}
                  </time>
                ) : null}
              </li>
            );
          })}
        </ol>
      </Card>
    </section>
  );
}
