import { describe, expect, it } from "vitest";
import {
  adaptCustomerProfile,
  adaptNotificationPreferences,
  adaptProfileChallenge,
  verificationLabel,
} from "@/lib/customer/profile-adapter";

describe("customer profile adapter", () => {
  it("maps customer-safe profile fields and masks contacts", () => {
    const view = adaptCustomerProfile({
      id: "user_1",
      firstName: "علی",
      lastName: "رضایی",
      phone: "09121234567",
      email: "ali@example.com",
      phoneVerified: true,
      emailVerified: "pending",
      pendingEmail: "new@example.com",
      internalNotes: "محرمانه",
      tags: ["vip"],
    });
    expect(view?.displayName).toBe("علی رضایی");
    expect(view?.phoneMasked).toContain("***");
    expect(view?.emailMasked).toContain("***");
    expect(view?.pendingEmailMasked).toContain("***");
    expect(view?.phoneVerified).toBe("verified");
    expect(view?.emailVerified).toBe("pending");
    expect(view?.avatar.initials).toBe("عر");
  });

  it("defaults change capabilities to allowed unless denied", () => {
    const view = adaptCustomerProfile({
      id: "user_2",
      displayName: "مشتری",
      canChangePhone: false,
    });
    expect(view?.canChangePhone).toBe(false);
    expect(view?.canChangeEmail).toBe(true);
    expect(view?.avatarUploadSupported).toBe(false);
  });

  it("maps notification preferences and preserves required flags", () => {
    const prefs = adaptNotificationPreferences({
      items: [
        {
          id: "n1",
          eventKey: "appointment_reminder",
          label: "یادآوری نوبت",
          channel: "sms",
          enabled: true,
          required: true,
        },
        {
          id: "n2",
          eventKey: "promo",
          label: "پیام‌های اختیاری",
          channel: "email",
          enabled: false,
          required: false,
        },
      ],
      disclaimer: "تحویل تضمینی نیست.",
    });
    expect(prefs.items).toHaveLength(2);
    expect(prefs.items[0]?.required).toBe(true);
    expect(prefs.items[0]?.enabled).toBe(true);
    expect(prefs.disclaimer).toBe("تحویل تضمینی نیست.");
  });

  it("maps profile challenges with masked destination", () => {
    const challenge = adaptProfileChallenge(
      {
        challengeId: "ch_1",
        maskedDestination: "0912***67",
        expiresAt: "2026-08-22T12:00:00.000Z",
        resendAvailableAt: "2026-08-22T11:59:00.000Z",
      },
      "change_phone",
    );
    expect(challenge.challengeId).toBe("ch_1");
    expect(challenge.purpose).toBe("change_phone");
    expect(verificationLabel("verified")).toBe("تأییدشده");
  });
});
