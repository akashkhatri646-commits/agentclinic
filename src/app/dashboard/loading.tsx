export default function Loading() {
  return (
    <div className="dashboard-content">
      <article>
        <header>
          <div className="skeleton" style={{ height: "1.5rem", width: "12rem" }} aria-hidden="true" />
        </header>
        <div className="skeleton" style={{ height: "6rem", marginBottom: "1rem" }} aria-hidden="true" />
        <div className="skeleton" style={{ height: "6rem" }} aria-hidden="true" />
      </article>
    </div>
  )
}
