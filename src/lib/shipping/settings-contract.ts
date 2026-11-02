import { sandboxCities, type City } from "@/lib/oto/contracts";
import { testDigits } from "@/lib/oto/return-contract";
export const shippingTestCouriers = [
  { id: "2828", name: "SMSA Express" },
  { id: "56468", name: "SMSA Bullet" },
  { id: "56469", name: "SMSA Same Day" },
  { id: "56470", name: "SMSA Pudo" },
  { id: "56471", name: "SMSA Heavy & Bulky" },
] as const;
export type ShippingSettingsInput = {
  version: number;
  warehouseId: string;
  courierIds: string[];
  collectionMethod: "PICKUP_BY_DC" | "BRANCH_DROP_OFF";
  capHalalas: number;
  automaticRequested: boolean;
};
export type WarehouseInput = {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  city: City;
  address: string;
  consent: true;
};
export function shippingId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
function fields(value: unknown, keys: string[]) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !keys.includes(k))
  )
    throw Error("invalid_input");
  return value as Record<string, unknown>;
}
function text(value: unknown, min: number, max: number) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max ||
    /[\u0000-\u001f<>]/.test(value)
  )
    throw Error("invalid_input");
  return value.trim();
}
export function settingsInput(value: unknown): ShippingSettingsInput {
  const v = fields(value, [
    "version",
    "warehouseId",
    "courierIds",
    "collectionMethod",
    "capHalalas",
    "automaticRequested",
  ]);
  if (
    !Number.isSafeInteger(v.version) ||
    Number(v.version) < 0 ||
    !shippingId(v.warehouseId) ||
    !Array.isArray(v.courierIds) ||
    v.courierIds.length < 1 ||
    v.courierIds.length > 5 ||
    v.courierIds.some((id) => !shippingTestCouriers.some((c) => c.id === id)) ||
    new Set(v.courierIds).size !== v.courierIds.length ||
    !["PICKUP_BY_DC", "BRANCH_DROP_OFF"].includes(String(v.collectionMethod)) ||
    !Number.isSafeInteger(v.capHalalas) ||
    Number(v.capHalalas) < 100 ||
    Number(v.capHalalas) > 1000000 ||
    typeof v.automaticRequested !== "boolean"
  )
    throw Error("invalid_input");
  return {
    version: Number(v.version),
    warehouseId: v.warehouseId,
    courierIds: v.courierIds,
    collectionMethod:
      v.collectionMethod as ShippingSettingsInput["collectionMethod"],
    capHalalas: Number(v.capHalalas),
    automaticRequested: v.automaticRequested,
  };
}
export function warehouseInput(value: unknown): WarehouseInput {
  const v = fields(value, [
    "name",
    "contactName",
    "email",
    "phone",
    "city",
    "address",
    "consent",
  ]);
  const email = text(v.email, 5, 254).toLowerCase(),
    phone = testDigits(text(v.phone, 9, 25))
      .replace(/[\s()+-]/g, "")
      .replace(/^00966/, "966")
      .replace(/^0(?=5)/, "966");
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !/^9665\d{8}$/.test(phone) ||
    !sandboxCities.includes(v.city as City) ||
    v.consent !== true
  )
    throw Error("invalid_input");
  return {
    name: text(v.name, 2, 64),
    contactName: text(v.contactName, 2, 80),
    email,
    phone,
    city: v.city as City,
    address: text(v.address, 12, 300),
    consent: true,
  };
}
export function warehouseProviderMatches(
  row: Record<string, any>,
  input: WarehouseInput,
  code: string,
) {
  const phone = String(row.contactPhone ?? row.mobile ?? "")
    .replace(/[\s()+-]/g, "")
    .replace(/^00966/, "966")
    .replace(/^0(?=5)/, "966")
    .replace(/^5(?=\d{8}$)/, "9665");
  return (
    row.code === code &&
    row.name === input.name &&
    row.city === input.city &&
    row.address === input.address &&
    (row.contactPerson ?? row.contactName) === input.contactName &&
    String(row.contactEmail ?? "").toLowerCase() === input.email &&
    phone === input.phone
  );
}

/** Packed parcel for one exact SKU and return quantity. No inferred unit-weight multiplication. */
export function parcelInput(value: unknown) {
  const v = fields(value, [
    "sku",
    "quantity",
    "version",
    "weightGrams",
    "lengthMm",
    "widthMm",
    "heightMm",
    "consent",
  ]);
  const sku = text(v.sku, 1, 100);
  if (
    v.consent !== true ||
    !Number.isSafeInteger(v.version) ||
    Number(v.version) < 0 ||
    !Number.isSafeInteger(v.quantity) ||
    Number(v.quantity) < 1 ||
    Number(v.quantity) > 20
  )
    throw Error("invalid_input");
  for (const k of ["weightGrams", "lengthMm", "widthMm", "heightMm"])
    if (
      !Number.isSafeInteger(v[k]) ||
      Number(v[k]) < 1 ||
      Number(v[k]) > (k === "weightGrams" ? 30000 : 1500)
    )
      throw Error("invalid_input");
  return {
    sku,
    quantity: Number(v.quantity),
    version: Number(v.version),
    weightGrams: Number(v.weightGrams),
    lengthMm: Number(v.lengthMm),
    widthMm: Number(v.widthMm),
    heightMm: Number(v.heightMm),
    consent: true,
  };
}
