"use client";

import {
  directionsHref,
  EXTERNAL_LINK_REL,
  mailtoHref,
  telHref,
} from "@/lib/public/links";
import type { PublicBusinessContact } from "@/types/appointment-detail";

export function AppointmentContactBusiness({ contact }: { contact: PublicBusinessContact }) {
  const tel = contact.phone ? telHref(contact.phone) : undefined;
  const mail = contact.email ? mailtoHref(contact.email) : undefined;
  const directions = directionsHref(contact.address, contact.directionsUrl);
  const hasContact = Boolean(tel || mail || contact.address || directions || contact.hoursLabel || contact.messageUrl);

  if (!hasContact) {
    return null;
  }

  return (
    <section className="appointment-detail-card" aria-labelledby="appointment-contact">
      <h2 id="appointment-contact" className="text-card-title">
        تماس با مجموعه
      </h2>
      <ul className="appointment-contact-list">
        {tel ? (
          <li>
            <a href={tel} className="ltr-value">
              تماس تلفنی
            </a>
            <span className="ltr-value">{contact.phone}</span>
          </li>
        ) : null}
        {mail ? (
          <li>
            <a href={mail} className="ltr-value">
              ارسال ایمیل
            </a>
            <span className="ltr-value">{contact.email}</span>
          </li>
        ) : null}
        {contact.messageUrl ? (
          <li>
            <a href={contact.messageUrl} target="_blank" rel={EXTERNAL_LINK_REL}>
              پیام به مجموعه
            </a>
          </li>
        ) : null}
        {contact.address ? (
          <li>
            <span>نشانی</span>
            <span>{contact.address}</span>
          </li>
        ) : null}
        {directions ? (
          <li>
            <a href={directions} target="_blank" rel={EXTERNAL_LINK_REL}>
              مسیر و نقشه
            </a>
          </li>
        ) : null}
        {contact.hoursLabel ? (
          <li>
            <span>ساعات پاسخ‌گویی</span>
            <span>{contact.hoursLabel}</span>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
