import type { Metadata } from "next"
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
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        {children}
      </body>
    </html>
  )
}
