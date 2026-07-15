import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentAccount, UnauthorizedError } from "@/lib/auth/account";
import { getEffectiveAccountAccess } from "@/lib/billing/access";
import { DashboardShell } from "./dashboard-shell";

// Server layout whose only job is to declare "do not index" metadata
// for the authed app. robots.ts already disallows these paths at the
// crawler-level and middleware redirects unauthenticated visitors, so
// this is belt-and-suspenders — but SEO-critical if a URL ever leaks
// via a link shared externally.
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let accountId: string;
  try {
    ({ accountId } = await getCurrentAccount());
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/login");
    throw error;
  }

  const access = await getEffectiveAccountAccess(accountId);

  if (!access.isActive) {
    if (access.source === "trial" && access.status === "expired") {
      redirect("/trial-expirado");
    }
    redirect("/planos");
  }

  return <DashboardShell>{children}</DashboardShell>;
}
