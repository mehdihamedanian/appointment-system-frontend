import { Card } from "@/components/ui/data-display";
import { HomeSection } from "@/features/public/home-section";
import {
  directionsHref,
  EXTERNAL_LINK_REL,
  mailtoHref,
  telHref,
} from "@/lib/public/links";
import type { PublicBusiness } from "@/types/public";

export function ContactSection({ business }: { business: PublicBusiness }) {
  const tel = business.phone ? telHref(business.phone) : undefined;
  const mail = business.email ? mailtoHref(business.email) : undefined;
  const directions = directionsHref(business.address, business.directionsUrl);
  const hasContact = Boolean(tel || mail || business.address || business.socialLinks.length);

  if (!hasContact) {
    return null;
  }

  return (
    <HomeSection id="contact" title="تماس و آدرس">
      <Card>
        <ul className="public-contact-list">
          {tel ? (
            <li>
              <a href={tel} className="ltr-value">
                تماس تلفنی
              </a>
              <span className="ltr-value">{business.phone}</span>
            </li>
          ) : null}
          {mail ? (
            <li>
              <a href={mail} className="ltr-value">
                ارسال ایمیل
              </a>
              <span className="ltr-value">{business.email}</span>
            </li>
          ) : null}
          {business.address ? (
            <li>
              <span>نشانی</span>
              <span>{business.address}</span>
            </li>
          ) : null}
          {directions ? (
            <li>
              <a href={directions} target="_blank" rel={EXTERNAL_LINK_REL}>
                مسیر و نقشه
              </a>
            </li>
          ) : null}
          {business.socialLinks.map((link) => (
            <li key={link.href}>
              <a href={link.href} target="_blank" rel={EXTERNAL_LINK_REL}>
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </Card>
    </HomeSection>
  );
}
