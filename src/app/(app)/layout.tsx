import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getMembership } from "@/lib/permissions";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/welcome");
  const membership = await getMembership(user.id);
  if (!membership) redirect("/onboarding");
  return (
    <AppShell userName={user.name} householdName={membership.householdName} role={membership.role}>
      {children}
    </AppShell>
  );
}
