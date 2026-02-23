import { Metadata } from "next";

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
    return {
      title: `${session?.stylist_name || "A friend"} styled you on Mei`,
      description: `${session?.friend_name || "You"}, check out the looks picked just for you. Swipe through your personalized list.`,
      openGraph: {
        title: `${session?.stylist_name || "A friend"} styled you on Mei`,
        description: `Swipe through your personalized look list from ${session?.stylist_name || "a friend"}.`,
        siteName: "Mei",
      },
    };
  } catch {
    return {
      title: "You've been styled on Mei",
      description: "A friend picked looks just for you. Come see your personalized list.",
    };
  }
}

export default function ForLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
