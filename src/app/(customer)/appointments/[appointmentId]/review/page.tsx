import { AppointmentReviewScreen } from "@/features/customer/appointment-review-screen";

type AppointmentReviewPageProps = {
  params: Promise<{ appointmentId: string }>;
};

export async function generateMetadata({ params }: AppointmentReviewPageProps) {
  const { appointmentId } = await params;
  return {
    title: `ثبت نظر ${appointmentId}`,
    robots: { index: false, follow: false },
  };
}

export default async function AppointmentReviewPage({ params }: AppointmentReviewPageProps) {
  const { appointmentId } = await params;
  return <AppointmentReviewScreen reference={appointmentId} />;
}
