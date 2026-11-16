import { cookies } from "next/headers";

export async function getServerLocale(): Promise<"en" | "nb"> {
  const store = await cookies();
  return store.get("usefirst_locale")?.value === "nb" ? "nb" : "en";
}
