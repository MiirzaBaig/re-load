export const sampleParcel = {
  weight: 1,
  length: 30,
  width: 20,
  height: 12,
} as const;
export const sandboxCities = ["Riyadh", "Jeddah", "Dammam"] as const;
export type City = (typeof sandboxCities)[number];
export type QuoteInput = {
  originCity: City;
  destinationCity: City;
  weight: number;
  length: number;
  width: number;
  height: number;
};
import type { CourierRate } from "../../../supabase/functions/_shared/shipping-rates";
export {
  courierRates,
  type CourierRate,
} from "../../../supabase/functions/_shared/shipping-rates";
export type SandboxConnection = {
  environment: "sandbox";
  healthy: boolean;
  plan: string;
  checkedAt: string;
};
export type SandboxQuotes = {
  environment: "sandbox";
  input: QuoteInput;
  rates: CourierRate[];
  checkedAt: string;
};
export function quoteInput(value: unknown): QuoteInput {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("invalid_input");
  const v = value as Record<string, unknown>;
  if (
    Object.keys(v).some(
      (key) =>
        ![
          "originCity",
          "destinationCity",
          "weight",
          "length",
          "width",
          "height",
        ].includes(key),
    )
  )
    throw new Error("invalid_input");
  if (
    !sandboxCities.includes(v.originCity as City) ||
    !sandboxCities.includes(v.destinationCity as City)
  )
    throw new Error("invalid_input");
  for (const key of ["weight", "length", "width", "height"]) {
    const n = v[key];
    if (
      typeof n !== "number" ||
      !Number.isFinite(n) ||
      n <= 0 ||
      n > (key === "weight" ? 30 : 150) ||
      Math.abs(Math.round(n * 100) - n * 100) > 0.000001
    )
      throw new Error("invalid_input");
  }
  return {
    originCity: v.originCity as City,
    destinationCity: v.destinationCity as City,
    weight: v.weight as number,
    length: v.length as number,
    width: v.width as number,
    height: v.height as number,
  };
}
