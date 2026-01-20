import type { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { MongoDBAdapter } from "@auth/mongodb-adapter"
import clientPromise from "./mongodb"
import { getUsersCollection } from "./db"
import { ObjectId } from "mongodb"

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error("Missing Google OAuth environment variables")
}

if (!process.env.NEXTAUTH_SECRET) {
  throw new Error("Missing NEXTAUTH_SECRET environment variable")
}

export const authOptions: NextAuthOptions = {
  adapter: MongoDBAdapter(clientPromise),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    // JWT callback - add user ID and isActive status to token
    jwt: async ({ token, user }) => {
      if (user) {
        token.sub = user.id
      }
      
      // Fetch fresh isActive status from database
      if (token.sub && ObjectId.isValid(token.sub)) {
        try {
          const users = await getUsersCollection()
          const dbUser = await users.findOne({ _id: new ObjectId(token.sub) })
          token.isActive = dbUser?.isActive ?? false
        } catch (error) {
          console.error("[Auth] Error fetching user isActive status:", error)
          token.isActive = false
        }
      } else {
        token.isActive = false
      }
      
      return token
    },
    // Session callback - add user ID and isActive status to session
    session: async ({ session, token }) => {
      if (session.user && token.sub) {
        session.user.id = token.sub
        session.user.isActive = token.isActive as boolean
      }
      return session
    },
  },
  pages: {
    signIn: "/signin",
  },
  session: {
    strategy: "jwt", // Use JWT for Socket.io compatibility
  },
  events: {
    // Set new users as inactive by default, unless they're an admin
    createUser: async ({ user }) => {
      if (user.id && ObjectId.isValid(user.id)) {
        try {
          const users = await getUsersCollection()
          
          // Check if user is an admin (matches ADMIN_EMAIL env var)
          const adminEmail = process.env.ADMIN_EMAIL
          const isAdmin = adminEmail && user.email === adminEmail
          
          await users.updateOne(
            { _id: new ObjectId(user.id) },
            { $set: { isActive: isAdmin ? true : false, updatedAt: new Date() } }
          )
          
          if (isAdmin) {
            console.log(`[Auth] New ADMIN user created and activated: ${user.email}`)
          } else {
            console.log(`[Auth] New user created and set as inactive: ${user.email}`)
          }
        } catch (error) {
          console.error("[Auth] Error setting user status:", error)
        }
      }
    },
  },
}

