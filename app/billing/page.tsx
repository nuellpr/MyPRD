import { redirect } from "next/navigation";
import { BillingPanel, type AdminOrderItem } from "@/components/BillingPanel";
import { WordReveal } from "@/components/motion/Reveal";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { currentUser } from "@/lib/auth";
import { billingProvider, midtransSnapJsUrl } from "@/lib/billing";
import { isAdminEmail } from "@/lib/env";
import { PLANS } from "@/lib/plans";
import { parseQrisOrderRef } from "@/lib/qris";
import { getQuotaState, listAllOrdersForAdmin, listOrders } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Billing — MyPRD" };

export default async function BillingPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/billing");

  const provider = billingProvider();
  const quota = getQuotaState(user.id, user.plan);
  const isAdmin = isAdminEmail(user.email);
  const adminOrders: AdminOrderItem[] = isAdmin
    ? listAllOrdersForAdmin(40).map((o) => {
        const meta = o.provider === "qris" ? parseQrisOrderRef(o.providerRef) : null;
        return {
          id: o.id,
          plan: o.plan,
          amountIdr: o.amountIdr,
          status: o.status,
          provider: o.provider,
          createdAt: o.createdAt,
          userEmail: o.userEmail,
          userName: o.userName,
          confirmedAt: meta?.confirmedAt,
          note: meta?.note,
        };
      })
    : [];

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader authed />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        <WordReveal text="Billing & paket" className="text-2xl font-semibold text-white sm:text-3xl" />
        <p className="mt-1 text-sm text-slate-400">
          Paket aktif:{" "}
          <span className="font-medium text-slate-200">
            {PLANS[user.plan as keyof typeof PLANS]?.name ?? user.plan}
          </span>
          {" · "}
          {quota.unlimited ? "kuota tak terbatas" : `sisa kuota ${quota.remaining}/${quota.limit} bulan ini`}
        </p>

        <div className="mt-6">
          <BillingPanel
            currentPlan={user.plan}
            orders={listOrders(user.id)}
            plans={[PLANS.starter, PLANS.pro]}
            provider={provider}
            snapJsUrl={midtransSnapJsUrl()}
            isAdmin={isAdmin}
            adminOrders={adminOrders}
          />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
