import { WaitingListOfferScreen } from "@/features/customer/waiting-list-offer-screen";

type WaitingListOfferPageProps = {
  params: Promise<{ offerReference: string }>;
};

export async function generateMetadata({ params }: WaitingListOfferPageProps) {
  const { offerReference } = await params;
  return {
    title: `پیشنهاد نوبت ${offerReference}`,
    robots: { index: false, follow: false },
  };
}

export default async function WaitingListOfferPage({ params }: WaitingListOfferPageProps) {
  const { offerReference } = await params;
  return <WaitingListOfferScreen reference={offerReference} />;
}
