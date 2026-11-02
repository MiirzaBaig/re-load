import "server-only";
import { createHash } from "node:crypto";
import { billingAdmin } from "@/lib/billing-server";
import { shippingTopupProvider } from "./topups";
import { ReturnProvider } from "@/lib/oto/return-provider";
import { courierRates, sampleParcel, sandboxCities } from "@/lib/oto/contracts";
import {
  parcelInput,
  settingsInput,
  warehouseInput,
  warehouseProviderMatches,
  shippingId,
  type WarehouseInput,
  type ShippingSettingsInput,
} from "./settings-contract";
export class ShippingSettingsError extends Error {
  constructor(
    public code: string,
    public status = 409,
  ) {
    super(code);
  }
}
function gate(email: string) {
  shippingTopupProvider(email);
  if (process.env.SHIPPING_SANDBOX_SETTINGS_ENABLED !== "true")
    throw new ShippingSettingsError("disabled", 503);
}
async function rpc(name: string, args: Record<string, unknown>) {
  const r = await billingAdmin().rpc(name, args);
  if (r.error) {
    const known = [
      "access_denied",
      "premium_required",
      "invalid_input",
      "warehouse_required",
      "settings_changed",
      "policy_required",
      "wallet_on_hold",
      "warehouse_pending",
      "warehouse_request_mismatch",
      "parcel_invalid",
    ].find((c) => r.error.message?.includes(c));
    throw new ShippingSettingsError(
      known || "records_unavailable",
      known === "access_denied" ? 403 : known ? 409 : 503,
    );
  }
  return r.data;
}
async function records(store: string, user: string) {
  return rpc("shipping_settings_snapshot", { p_store: store, p_user: user });
}
async function providerWarehouses() {
  const provider = new ReturnProvider();
  await provider.connect();
  const response = await provider.request("/getPickupLocationList");
  if (response.success !== true || !Array.isArray(response.warehouses))
    throw new ShippingSettingsError("provider_unavailable", 503);
  return { provider, warehouses: response.warehouses };
}
async function verifyOptions(
  provider: ReturnProvider,
  city: string,
  input: ShippingSettingsInput,
) {
  const response = await provider.request("/checkOTODeliveryFee", {
    originCity: "Riyadh",
    destinationCity: city,
    originCountry: "SA",
    destinationCountry: "SA",
    currency: "SAR",
    ...sampleParcel,
    packageCount: 1,
    totalDue: 0,
    forReverseShipment: true,
  });
  const rates = courierRates(response);
  for (const id of input.courierIds) {
    const r = rates.find((x) => x.id === id && x.sandboxBookable);
    if (
      !r ||
      r.price === null ||
      r.price <= 0 ||
      (input.collectionMethod === "PICKUP_BY_DC"
        ? !["pickup", "either"].includes(r.pickup)
        : !["dropoff", "either"].includes(r.pickup))
    )
      throw new ShippingSettingsError("courier_unavailable");
  }
}
function warehouseView(registered: any[], rows: any[], canManage: boolean) {
  return registered.flatMap((m: any) => {
    const row = rows.find((r: any) => r.code === m.code);
    if (
      !row ||
      !sandboxCities.includes(row.city) ||
      typeof row.address !== "string" ||
      row.address.length < 12
    )
      return [];
    return [
      {
        id: m.id,
        name: m.code.startsWith("RLDW")
          ? "Test return warehouse"
          : typeof row.name === "string"
            ? row.name
            : "Return warehouse",
        city: row.city,
        ...(canManage ? { address: row.address.slice(0, 300) } : {}),
      },
    ];
  });
}
export async function getShippingSettings(
  store: string,
  user: { id: string; email?: string },
) {
  gate(user.email || "");
  const base = await records(store, user.id);
  let warehouseChanged = false;
  let warehouses: any[] = [],
    providerReady = true;
  try {
    const source = await providerWarehouses();
    const verified = warehouseView(base.warehouses, source.warehouses, true);
    const approved = verified.find((w) => w.id === base.settings?.warehouse_id);
    warehouseChanged =
      base.settings?.state === "APPROVED" &&
      (!approved ||
        createHash("sha256").update(JSON.stringify(approved)).digest("hex") !==
          base.settings.approved_warehouse_fingerprint);
    warehouses = base.canManage
      ? verified
      : verified.map(({ address: _address, ...row }) => row);
  } catch {
    providerReady = false;
  }
  const wallet = await rpc("shipping_wallet_snapshot", {
    p_store: store,
    p_environment: "sandbox",
  });
  return {
    environment: "sandbox",
    ...base,
    ...(await rpc("shipping_parcel_snapshot", {
      p_store: store,
      p_user: user.id,
    })),
    settings: base.settings
      ? { ...base.settings, approved_warehouse_fingerprint: undefined }
      : null,
    warehouseChanged,
    warehouses,
    providerReady,
    automationActive: false,
    activation: "not_connected",
    wallet: {
      availableHalalas: wallet.availableHalalas,
      reservedHalalas: wallet.reservedHalalas,
      onHold: wallet.onHold,
      unconfirmed:
        wallet.attempts?.filter((r: any) =>
          ["UNKNOWN", "SUBMITTING"].includes(r.state),
        ).length || 0,
    },
  };
}
export async function saveShippingSettings(
  store: string,
  user: { id: string; email?: string },
  raw: unknown,
) {
  gate(user.email || "");
  let input;
  try {
    input = settingsInput(raw);
  } catch {
    throw new ShippingSettingsError("invalid_input", 400);
  }
  const base = await records(store, user.id);
  if (!base.canManage) throw new ShippingSettingsError("access_denied", 403);
  if (!base.premium) throw new ShippingSettingsError("premium_required");
  const mapped = base.warehouses.find((w: any) => w.id === input.warehouseId);
  if (!mapped) throw new ShippingSettingsError("warehouse_required");
  const source = await providerWarehouses(),
    warehouse = warehouseView([mapped], source.warehouses, true)[0];
  if (!warehouse) throw new ShippingSettingsError("warehouse_required");
  await verifyOptions(source.provider, warehouse.city, input);
  await rpc("shipping_settings_save", {
    p_store: store,
    p_user: user.id,
    p_version: input.version,
    p_warehouse: input.warehouseId,
    p_couriers: input.courierIds,
    p_method: input.collectionMethod,
    p_cap: input.capHalalas,
    p_automatic: input.automaticRequested,
  });
  return getShippingSettings(store, user);
}
export async function approveShippingSettings(
  store: string,
  user: { id: string; email?: string },
  version: unknown,
) {
  gate(user.email || "");
  if (!Number.isSafeInteger(version) || Number(version) < 1)
    throw new ShippingSettingsError("invalid_input", 400);
  const base = await records(store, user.id);
  if (!base.canManage) throw new ShippingSettingsError("access_denied", 403);
  if (!base.premium) throw new ShippingSettingsError("premium_required");
  const s = base.settings;
  if (!s || s.version !== version)
    throw new ShippingSettingsError("settings_changed");
  const mapped = base.warehouses.find((w: any) => w.id === s.warehouse_id);
  if (!mapped) throw new ShippingSettingsError("warehouse_required");
  const source = await providerWarehouses(),
    warehouse = warehouseView([mapped], source.warehouses, true)[0];
  if (!warehouse) throw new ShippingSettingsError("warehouse_required");
  await verifyOptions(source.provider, warehouse.city, {
    version: s.version,
    warehouseId: s.warehouse_id,
    courierIds: s.courier_ids,
    collectionMethod: s.collection_method,
    capHalalas: s.cap_halalas,
    automaticRequested: s.automatic_requested,
  });
  await rpc("shipping_settings_approve", {
    p_store: store,
    p_user: user.id,
    p_version: version,
    p_warehouse_fingerprint: createHash("sha256")
      .update(JSON.stringify(warehouse))
      .digest("hex"),
  });
  return getShippingSettings(store, user);
}
export async function pauseShippingSettings(
  store: string,
  user: { id: string; email?: string },
  version: unknown,
) {
  gate(user.email || "");
  if (!Number.isSafeInteger(version) || Number(version) < 1)
    throw new ShippingSettingsError("invalid_input", 400);
  await rpc("shipping_settings_pause", {
    p_store: store,
    p_user: user.id,
    p_version: version,
  });
  return getShippingSettings(store, user);
}
function hash(input: WarehouseInput) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}
export async function manageShippingWarehouse(
  store: string,
  user: { id: string; email?: string },
  id: unknown,
  raw: unknown,
  recover = false,
) {
  gate(user.email || "");
  if (!shippingId(id)) throw new ShippingSettingsError("invalid_input", 400);
  let input;
  try {
    input = warehouseInput(raw);
  } catch {
    throw new ShippingSettingsError("warehouse_input_invalid", 400);
  }
  const base = await records(store, user.id);
  if (!base.canManage) throw new ShippingSettingsError("access_denied", 403);
  if (!base.premium) throw new ShippingSettingsError("premium_required");
  const fingerprint = hash(input),
    code = "RLDSET" + id.replaceAll("-", "");
  if (!recover) {
    const claimed = await rpc("shipping_settings_warehouse_start", {
      p_id: id,
      p_store: store,
      p_user: user.id,
      p_fingerprint: fingerprint,
    });
    if (!claimed) throw new ShippingSettingsError("warehouse_pending");
  } else if (base.pendingWarehouse?.id !== id)
    throw new ShippingSettingsError("warehouse_pending");
  try {
    const source = await providerWarehouses();
    if (!recover) {
      const created = await source.provider.request("/createPickupLocation", {
        type: "warehouse",
        code,
        name: input.name,
        mobile: input.phone,
        address: input.address,
        contactName: input.contactName,
        contactEmail: input.email,
        city: input.city,
        country: "SA",
      });
      if (created.success !== true || created.pickupLocationCode !== code)
        throw Error("unconfirmed");
    }
    const list = recover
      ? source.warehouses
      : (await source.provider.request("/getPickupLocationList")).warehouses;
    const row = Array.isArray(list)
      ? list.find((r: any) => r.code === code)
      : null;
    if (!row || !warehouseProviderMatches(row, input, code))
      throw Error("unconfirmed");
    await rpc("shipping_settings_warehouse_finish", {
      p_id: id,
      p_store: store,
      p_user: user.id,
      p_fingerprint: fingerprint,
      p_verified: true,
    });
    return getShippingSettings(store, user);
  } catch {
    try {
      await rpc("shipping_settings_warehouse_finish", {
        p_id: id,
        p_store: store,
        p_user: user.id,
        p_fingerprint: fingerprint,
        p_verified: false,
      });
    } catch {}
    throw new ShippingSettingsError("warehouse_pending");
  }
}

export async function saveShippingParcel(
  store: string,
  user: { id: string; email?: string },
  raw: unknown,
) {
  gate(user.email || "");
  let input;
  try {
    input = parcelInput(raw);
  } catch {
    throw new ShippingSettingsError("parcel_invalid", 400);
  }
  await rpc("shipping_parcel_save", {
    p_store: store,
    p_user: user.id,
    p_sku: input.sku,
    p_quantity: input.quantity,
    p_version: input.version,
    p_weight: input.weightGrams,
    p_length: input.lengthMm,
    p_width: input.widthMm,
    p_height: input.heightMm,
    p_consent: true,
  });
  return getShippingSettings(store, user);
}
