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
            className={`card-lift flex flex-col rounded-2xl border p-6 ${
              isHighlight
                ? "glow-border border-transparent bg-[#0d142a]/85 shadow-lg shadow-[#35d6ff]/10"
                : "border-slate-800/90 bg-[#0b1020]/70"
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
              {id === "pro" ? (
                <span className="rounded-full border border-[#a78bfa]/40 bg-[#a78bfa]/15 px-2.5 py-1 text-xs font-medium text-[#c4b5fd]">
                  Populer
                </span>
              ) : null}
            </div>
            <p className="mt-3">
              <span className="text-3xl font-bold text-white">{formatIdr(plan.priceIdr)}</span>
              <span className="text-sm text-slate-400">{plan.priceIdr === 0 ? " selamanya" : "/bulan"}</span>
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {plan.monthlyQuota >= 1000 ? "Kuota besar (fair use)" : `${plan.monthlyQuota} generate PRD/bulan`}
            </p>
            <ul className="mt-5 flex-1 space-y-2 text-sm text-slate-300">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <span className="text-[#35d6ff]">✓</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <Link
              href={id === "free" ? "/register" : "/billing"}
              className={`btn-shine mt-6 rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition ${
                isHighlight
                  ? "bg-linear-to-r from-[#4f7cff] via-[#35d6ff] to-[#a78bfa] text-slate-950 hover:brightness-110"
                  : "border border-slate-700 text-slate-200 hover:border-[#35d6ff]/50 hover:text-white"
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
