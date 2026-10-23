import "@/styles/layout.css"
import Header from "./Header"
import Main from "./Main"
import Footer from "./Footer"

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="main-layout">
      <Header />
      <Main>{children}</Main>
      <Footer />
    </div>
  )
}
