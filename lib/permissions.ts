const RESOURCE_PERMISSION_ALIASES: Record<string, string> = {
  knowledge: "agents",
  documents: "agents",
  conversations: "agents",
  analytics: "agents",
  settings: "agents",
};

function normalizePermissionResource(resource: string): string {
  return RESOURCE_PERMISSION_ALIASES[resource] ?? resource;
}

function normalizePermissionName(permissionName: string): string {
  if (permissionName === "*" || !permissionName.includes(":")) return permissionName;
  const [resource, action] = permissionName.split(":", 2);
  return `${normalizePermissionResource(resource)}:${action}`;
}

export function hasPermission(permissionNames: string[] | null | undefined, permissionName: string): boolean {
  if (!permissionNames) return false;
  const normalizedPermission = normalizePermissionName(permissionName);
  return permissionNames.some(
    (permission) => permission === "*" || normalizePermissionName(permission) === normalizedPermission,
  );
}

export function hasAnyPermissionForResource(
  permissionNames: string[] | null | undefined,
  resource: string,
): boolean {
  if (!permissionNames) return false;
  const normalizedResource = normalizePermissionResource(resource);
  return permissionNames.some((permission) => {
    if (permission === "*") return true;
    return normalizePermissionName(permission).startsWith(`${normalizedResource}:`);
  });
}
