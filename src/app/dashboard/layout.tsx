import MainLayout from "@/components/layout/MainLayout"
import Sidebar from "@/components/Sidebar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <MainLayout>
      <Sidebar />
      <div className="flex-1 p-6">{children}</div>
    </MainLayout>
  )
}
