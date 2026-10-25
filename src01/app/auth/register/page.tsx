import type { Metadata } from "next";
import RegisterWizard from "./RegisterWizard";

export const metadata: Metadata = { title: "Create your account" };

/**
 * /auth/register                       the signup questions
 * /auth/register?invite=<transaction>  the same, starting from a seller's invitation
 */
export default function RegisterPage({ searchParams }: { searchParams: { invite?: string | string[] } }) {
  const invite = Array.isArray(searchParams.invite) ? searchParams.invite[0] : searchParams.invite;
  return <RegisterWizard inviteId={invite || ""} />;
}
