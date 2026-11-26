import { PasswordRecoveryForm } from "@/components/PasswordRecoveryForm";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; devCode?: string }>;
}) {
  const { email, devCode } = await searchParams;
  return (
    <PasswordRecoveryForm
      mode="reset"
      email={typeof email === "string" ? email : ""}
      devCode={typeof devCode === "string" ? devCode : ""}
    />
  );
}
