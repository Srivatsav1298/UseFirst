import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getMembership } from "@/lib/permissions";
import { AuthForm } from "@/features/authentication/auth-form";

export const dynamic = "force-dynamic";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const user = await getCurrentUser();
  if (user) {
    const membership = await getMembership(user.id);
    if (next?.startsWith("/")) redirect(next);
    redirect(membership ? "/" : "/onboarding");
  }
  return <AuthForm next={next?.startsWith("/") ? next : undefined} />;
}
