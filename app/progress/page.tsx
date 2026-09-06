import Link from "next/link";
import FloatingNav from "../components/FloatingNav";

export default function Page() {
  return (
    <main className="app-shell page-shell">
      <section className="page-section" aria-labelledby="coming-title">
        <div className="page-topline"><p className="section-label">Progress</p></div>
        <div className="coming-content">
          <span aria-hidden="true" />
          <h1 id="coming-title">Coming soon<span className="red-period">.</span></h1>
          <p>Progress will be here later.</p>
          <Link href="/">Back to today ↗</Link>
        </div>
      </section>
      <FloatingNav active="progress" />
    </main>
  );
}
