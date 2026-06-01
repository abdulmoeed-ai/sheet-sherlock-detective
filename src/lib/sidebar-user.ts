import { roleOptions, type HumanRole } from "@/lib/api/auth";

export function getUserInitials(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "U";
}

export function getRoleLabel(role: HumanRole) {
  return roleOptions.find((option) => option.value === role)?.label ?? role;
}
