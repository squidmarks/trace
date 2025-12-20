"use client"

import { SessionProvider } from "next-auth/react"
import { EventProvider } from "@/contexts/EventContext"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <EventProvider>
        {children}
      </EventProvider>
    </SessionProvider>
  )
}

