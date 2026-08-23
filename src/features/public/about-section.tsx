import { HomeSection } from "@/features/public/home-section";
import { hasAboutContent } from "@/lib/public/adapters";
import type { PublicBusiness } from "@/types/public";

export function AboutSection({ business }: { business: PublicBusiness }) {
  if (!hasAboutContent(business)) {
    return null;
  }

  return (
    <HomeSection id="about" title="درباره مجموعه">
      <div className="public-about">
        {business.fieldOfActivity ? (
          <p>
            <strong>زمینه فعالیت: </strong>
            {business.fieldOfActivity}
          </p>
        ) : null}
        {business.about ? <p>{business.about}</p> : null}
        {!business.about && business.shortDescription ? <p>{business.shortDescription}</p> : null}
        {business.visitInfo ? (
          <p>
            <strong>مراجعه: </strong>
            {business.visitInfo}
          </p>
        ) : null}
      </div>
    </HomeSection>
  );
}
