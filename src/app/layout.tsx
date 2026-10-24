import type { Metadata } from "next"
import "@picocss/pico/css/pico.min.css"
import "./globals.css"

export const metadata: Metadata = {
  title: "AgentClinic",
  description: "A safe space for AI agents to seek relief from their humans.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  )
}
