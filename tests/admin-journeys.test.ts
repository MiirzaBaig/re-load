import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "../src/app/api/admin/journeys/route";
import { setAdminAccess } from "./fixtures/admin-access";
const snapshot = {
  environment: "development",
  checked_at: "2026-10-24T01:00:00Z",
  limit: 50,
  blocked: true,
  records: [],
};
test("journey endpoint rejects anonymous, merchant, sales and viewer access before any RPC", async () => {
  for (const role of [null, "merchant", "sales", "viewer"]) {
    let called = false;
    setAdminAccess(
      role
        ? {
            role,
            supabase: {
              rpc: () => {
                called = true;
              },
            },
          }
        : null,
    );
    const response = await GET();
    assert.equal(response.status, 403);
    assert.equal(called, false);
  }
});
test("owner snapshot calls only the staff-scoped RPC and strips extra fields", async () => {
  let called = "";
  setAdminAccess({
    role: "owner",
    supabase: {
      rpc: async (name: string) => {
        called = name;
        return { data: { ...snapshot, token: "not-for-browser" }, error: null };
      },
    },
  });
  const response = await GET();
  assert.equal(response.status, 200);
  assert.equal(called, "staff_checkout_monitor");
  assert.deepEqual(await response.json(), snapshot);
  assert(response.headers.get("cache-control")?.includes("no-store"));
});
test("database failures and malformed snapshots never expose raw messages or unsafe values", async () => {
  for (const result of [
    { data: null, error: { code: "XX000", message: "private@example.com" } },
    { data: { ...snapshot, environment: "unexpected" }, error: null },
  ]) {
    setAdminAccess({ role: "owner", supabase: { rpc: async () => result } });
    const response = await GET();
    assert.equal(response.status, 503);
    assert(!(await response.text()).includes("private@example.com"));
  }
});

test("a database-level owner or MFA refusal clears access instead of posing as a temporary outage", async () => {
  setAdminAccess({
    role: "owner",
    supabase: {
      rpc: async () => ({
        data: null,
        error: { code: "42501", message: "private detail" },
      }),
    },
  });
  const response = await GET();
  assert.equal(response.status, 403);
  assert(!(await response.text()).includes("private detail"));
});
