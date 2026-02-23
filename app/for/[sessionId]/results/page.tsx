import { Metadata } from "next";
import ResultsClient from "./ResultsClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}): Promise<Metadata> {
  const { sessionId } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  try {
    const res = await fetch(`${baseUrl}/api/sessions/${sessionId}`, { cache: "no-store" });
    const { session } = await res.json();
    const friendName = session?.friend_name || "your friend";
    const stylistName = session?.stylist_name;
    const title = stylistName
      ? `here's what ${friendName} loved from your mei list`
      : `here's what ${friendName} loved on mei`;
    const description = stylistName
      ? `${friendName} swiped through the list you made them on mei. see what they loved.`
      : `${friendName} went through their mei list. here's what they loved.`;
    return {
      title,
      description,
      openGraph: { title, description, siteName: "mei" },
    };
  } catch {
    return { title: "here's what your friend loved on mei" };
  }
}

export default function ResultsPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  return <ResultsClient params={params} />;
}
