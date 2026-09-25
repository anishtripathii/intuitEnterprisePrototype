import CloseWorkspace from "./CloseWorkspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Close workspace · Footnote for IES" };

export default async function ClosePage({ searchParams }: { searchParams: Promise<{ issue?: string }> }) {
  const { issue } = await searchParams;
  return <CloseWorkspace initialIssue={issue ?? null} />;
}
