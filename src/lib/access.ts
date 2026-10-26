export type StoreAccess = {
  full: boolean;
  settings: boolean;
  permissions: string[];
  name: string;
  email: string;
};

export function parseAccess(value: unknown): StoreAccess | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const permissions = Array.isArray(row.permissions)
    ? row.permissions.filter((item): item is string => typeof item === "string")
    : [];
  const full = row.full === true || permissions.includes("*");
  return {
    full,
    settings: full || row.settings === true || permissions.includes("settings.manage"),
    permissions,
    name: typeof row.name === "string" ? row.name : "",
    email: typeof row.email === "string" ? row.email : "",
  };
}

export function allows(access: StoreAccess | null, permission: string) {
  if (!access) return false;
  return access.full || access.permissions.includes("*") || access.permissions.includes(permission);
}

export function allowsAny(access: StoreAccess | null, permissions: readonly string[]) {
  return permissions.some((permission) => allows(access, permission));
}
