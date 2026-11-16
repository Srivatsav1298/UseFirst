import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getMembership } from "@/lib/permissions";
import { OnboardingForm } from "@/features/households/onboarding-form";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/welcome");
  const membership = await getMembership(user.id);
  if (membership) redirect("/");
  return <OnboardingForm userName={user.name} />;
}
