import { WaitingListEntryScreen } from "@/features/customer/waiting-list-entry-screen";

type WaitingListEntryPageProps = {
  params: Promise<{ entryReference: string }>;
};

export async function generateMetadata({ params }: WaitingListEntryPageProps) {
  const { entryReference } = await params;
  return {
    title: `درخواست انتظار ${entryReference}`,
    robots: { index: false, follow: false },
  };
}

export default async function WaitingListEntryPage({ params }: WaitingListEntryPageProps) {
  const { entryReference } = await params;
  return <WaitingListEntryScreen reference={entryReference} />;
}
