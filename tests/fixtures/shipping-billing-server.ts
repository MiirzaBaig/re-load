let member: any = null,
  admin: any = null;
export function shippingTestContext(m: any, a: any) {
  member = m;
  admin = a;
}
export async function billingMember(_store: unknown, write = false) {
  return member && (!write || ["owner", "admin"].includes(member.role))
    ? member
    : null;
}
export function billingAdmin() {
  return admin;
}
export function billingOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    throw Error("invalid_origin");
}
