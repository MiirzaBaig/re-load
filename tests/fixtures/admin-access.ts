let access: unknown = null;
export function setAdminAccess(value: unknown) {
  access = value;
}
export async function getAdminAccess() {
  return access;
}

export async function logAdminEvent(value: unknown) {
  if ((value as { auditFailure?: boolean }).auditFailure) throw new Error("private audit failure");
}
