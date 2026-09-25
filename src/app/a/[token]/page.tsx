import AnswerForm from "./AnswerForm";

export const metadata = { title: "Quick question from finance" };

export default async function AnswerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="max-w-[440px] mx-auto">
      <AnswerForm token={token} />
    </div>
  );
}
