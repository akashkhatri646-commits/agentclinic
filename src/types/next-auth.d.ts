import type { DefaultSession } from "next-auth"

export type Role = "AGENT" | "STAFF" | "ADMIN"

declare module "next-auth" {
  interface User {
    role: Role
  }
  interface Session {
    user: DefaultSession["user"] & {
      id: string
      role: Role
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: Role
  }
}
