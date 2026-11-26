import { PasswordRecoveryForm } from "@/components/PasswordRecoveryForm";

export const dynamic = "force-dynamic";

export default function LupaPasswordPage() {
  return <PasswordRecoveryForm mode="forgot" />;
}
