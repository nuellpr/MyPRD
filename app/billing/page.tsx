import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { BillingPanel } from "@/components/BillingPanel";
import { currentUser } from "@/lib/auth";
import { billingProvider, midtransSnapJsUrl } from "@/lib/billing";
import { PLANS } from "@/lib/plans";
import { getQuotaState, listOrders } from "@/lib/repo";

export const metadata = { title: "Billing — MyPRD" };

export default async function BillingPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/billing");

  const provider = billingProvider();
  const quota = getQuotaState(user.id, user.plan);

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader authed />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        <h1 className="text-2xl font-semibold">Billing & paket</h1>
        <p className="mt-1 text-sm text-slate-400">
          Paket aktif: <span className="font-medium text-slate-200">{PLANS[user.plan as keyof typeof PLANS]?.name ?? user.plan}</span>
          {" · "}sisa kuota {quota.remaining}/{quota.limit} bulan ini
        </p>

        <div className="mt-6">
          <BillingPanel
            currentPlan={user.plan}
            orders={listOrders(user.id)}
            plans={[PLANS.starter, PLANS.pro]}
            provider={provider}
            snapJsUrl={midtransSnapJsUrl()}
          />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
