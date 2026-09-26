import Link from "next/link";
import { formatIdr } from "@/lib/format";
import { PLANS, type PlanId } from "@/lib/plans";

export function PricingCards({ highlight }: { highlight?: PlanId }) {
  const order: PlanId[] = ["free", "starter", "pro"];
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {order.map((id) => {
        const plan = PLANS[id];
        const isHighlight = (highlight ?? "free") === id;
        return (
          <div
            key={id}
            className={`flex flex-col rounded-2xl border p-6 transition ${
              isHighlight ? "border-sky-500/70 bg-sky-500/5 shadow-lg shadow-sky-500/10" : "border-slate-800 bg-slate-900/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              {id === "pro" ? (
                <span className="rounded-full bg-indigo-500/15 px-2.5 py-1 text-xs font-medium text-indigo-300">Populer</span>
              ) : null}
            </div>
            <p className="mt-3">
              <span className="text-3xl font-bold">{formatIdr(plan.priceIdr)}</span>
              <span className="text-sm text-slate-400">{plan.priceIdr === 0 ? " selamanya" : "/bulan"}</span>
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {plan.monthlyQuota >= 1000 ? "Kuota besar (fair use)" : `${plan.monthlyQuota} generate PRD/bulan`}
            </p>
            <ul className="mt-5 flex-1 space-y-2 text-sm text-slate-300">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <span className="text-sky-400">✓</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <Link
              href={id === "free" ? "/register" : "/billing"}
              className={`mt-6 rounded-lg px-4 py-2.5 text-center text-sm font-medium transition ${
                isHighlight
                  ? "bg-sky-500 text-slate-950 hover:bg-sky-400"
                  : "border border-slate-700 text-slate-200 hover:border-slate-500 hover:text-white"
              }`}
            >
              {id === "free" ? "Mulai gratis" : "Pilih " + plan.name}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
