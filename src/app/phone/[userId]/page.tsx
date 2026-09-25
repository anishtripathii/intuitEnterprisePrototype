import Phone from "./Phone";

export const metadata = { title: "Demo phone" };

export default async function PhonePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return <Phone userId={userId} />;
}
