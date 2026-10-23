export type Role = "AGENT" | "STAFF" | "ADMIN"

export const isAdmin = (role: string): role is "ADMIN" => role === "ADMIN"

export const isStaff = (role: string): boolean =>
  role === "STAFF" || role === "ADMIN"

export const isAgent = (role: string): role is "AGENT" => role === "AGENT"

export const canAccessAdmin = (role: string): boolean => isAdmin(role)
