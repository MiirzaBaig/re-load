let access: unknown = null;
export function setAdminAccess(value: unknown) {
  access = value;
}
export async function getAdminAccess() {
  return access;
}
