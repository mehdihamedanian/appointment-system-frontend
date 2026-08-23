import { HomeSection } from "@/features/public/home-section";

export function ProcessSection() {
  return (
    <HomeSection id="process" title="مراحل رزرو">
      <ol className="public-process">
        <li>خدمت موردنظر را انتخاب کنید.</li>
        <li>در صورت نیاز، همکار را انتخاب کنید.</li>
        <li>روز و ساعت را مشخص کنید.</li>
        <li>رزرو را تأیید کنید.</li>
      </ol>
    </HomeSection>
  );
}
