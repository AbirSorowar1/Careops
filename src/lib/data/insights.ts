import type { Dataset } from "./types";
import { countBy, summariseMoney } from "./metrics";
import { formatMoney, formatPercent } from "./format";

export interface Insight {
  id: string;
  tone: "info" | "warning" | "success";
  title: string;
  body: string;
  link?: { to: "/clients" | "/caregivers" | "/data-quality" | "/financial" | "/services" | "/geography"; search?: Record<string, string> };
}

/** Plain-language findings computed from the current dataset only. */
export function buildInsights(ds: Dataset, currency: string): Insight[] {
  const out: Insight[] = [];
  const { clients, caregivers } = ds;

  if (clients.length) {
    const types = countBy(clients, (c) => c.serviceType.group);
    const topType = types[0];
    if (topType) {
      const tied = types.filter((t) => t.count === topType.count);
      out.push({
        id: "top-type",
        tone: "info",
        title: `${tied.map((t) => t.label).join(" & ")} ${tied.length > 1 ? "are" : "is"} the most common service type`,
        body: `${topType.count} of ${clients.length} client records (${formatPercent(topType.share)}). ${types.length} distinct service types are recorded.`,
        link: { to: "/clients", search: { type: topType.label } },
      });
    }
    const areas = countBy(clients, (c) => c.area.group);
    const topArea = areas[0];
    if (topArea) {
      out.push({
        id: "top-area",
        tone: "info",
        title: `${topArea.label} has the most recorded clients`,
        body: `${topArea.count} client records (${formatPercent(topArea.share)} of those with an area)${
          areas[1] ? `, followed by ${areas[1].label} (${areas[1].count})` : ""
        }.`,
        link: { to: "/clients", search: { area: topArea.label } },
      });
    }
    const cats = countBy(clients, (c) => c.category.group);
    if (cats.length) {
      out.push({
        id: "categories",
        tone: "info",
        title: `${cats.length} service categories`,
        body: cats.map((c) => `${c.label}: ${c.count}`).join(" · "),
        link: { to: "/services" },
      });
    }
    const cp = summariseMoney(clients, (c) => c.clientPay);
    const gp = summariseMoney(clients, (c) => c.caregiverPay);
    if (ds.clientColumns.has("clientPay") || ds.clientColumns.has("caregiverPay")) {
      const gaps = [
        cp.missingCount + cp.invalidCount ? `${cp.missingCount + cp.invalidCount} client pay` : null,
        gp.missingCount + gp.invalidCount ? `${gp.missingCount + gp.invalidCount} caregiver payment` : null,
      ].filter(Boolean);
      out.push({
        id: "payments",
        tone: gaps.length ? "warning" : "success",
        title: gaps.length ? `Payment values missing in ${gaps.join(" and ")} cells` : "Every client row has both payment values",
        body: `Recorded client pay totals ${formatMoney(cp.total, currency)}; recorded caregiver payments total ${formatMoney(gp.total, currency)}.`,
        link: { to: "/financial" },
      });
    }
  }

  if (caregivers.length) {
    const incomplete = caregivers.filter((c) => !c.complete).length;
    out.push({
      id: "cg-complete",
      tone: incomplete ? "warning" : "success",
      title: incomplete
        ? `${incomplete} caregiver record${incomplete === 1 ? "" : "s"} have missing or invalid details`
        : "All caregiver profiles are complete",
      body: `${caregivers.length - incomplete} of ${caregivers.length} caregiver profiles have age, address, education, experience and a valid mobile number.`,
      link: incomplete ? { to: "/data-quality", search: { type: "caregiver" } } : { to: "/caregivers" },
    });
    const exp = caregivers.filter((c) => c.experienceYears != null);
    const junior = exp.filter((c) => (c.experienceYears ?? 0) <= 1).length;
    if (exp.length && junior) {
      out.push({
        id: "junior",
        tone: "info",
        title: `${junior} caregivers have 1 year of experience or less`,
        body: `${formatPercent(junior / exp.length)} of caregivers with recorded experience — a group that may benefit from supervision or training.`,
        link: { to: "/caregivers", search: { exp: "1 yr" } },
      });
    }
  }

  const review = ds.issues.filter((i) => i.severity !== "info");
  const possibleDup = ds.issues.filter((i) => i.category === "possible_duplicate").length;
  if (review.length || possibleDup) {
    out.push({
      id: "attention",
      tone: "warning",
      title: `${new Set(review.map((i) => i.recordKey)).size} records need attention`,
      body: `${review.length} data issues found${possibleDup ? `, plus ${possibleDup} records sharing a name with another record` : ""}.`,
      link: { to: "/data-quality" },
    });
  }
  return out;
}
