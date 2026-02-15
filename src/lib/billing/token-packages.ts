// ---------------------------------------------------------------------------
// Token package definitions for top-up purchases
// ---------------------------------------------------------------------------

export const MONTHLY_TOKEN_ALLOCATION = 10_000_000; // 10M tokens included with $199/mo plan

export const TOKEN_PACKAGES = [
  {
    id: "starter",
    name: "Starter Pack",
    tokens: 2_000_000,
    priceCents: 2900, // $29
    priceDisplay: "$29",
    description: "2M tokens",
  },
  {
    id: "growth",
    name: "Growth Pack",
    tokens: 5_000_000,
    priceCents: 5900, // $59
    priceDisplay: "$59",
    description: "5M tokens",
    popular: true,
  },
  {
    id: "pro",
    name: "Pro Pack",
    tokens: 15_000_000,
    priceCents: 14900, // $149
    priceDisplay: "$149",
    description: "15M tokens",
  },
] as const;

export type TokenPackageId = (typeof TOKEN_PACKAGES)[number]["id"];

export function getTokenPackage(id: string) {
  return TOKEN_PACKAGES.find((p) => p.id === id);
}
