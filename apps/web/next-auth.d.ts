import { DefaultSession, DefaultUser } from "next-auth"
import { DefaultJWT } from "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      isActive: boolean
    } & DefaultSession["user"]
  }

  interface User extends DefaultUser {
    isActive?: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    isActive?: boolean
  }
}
