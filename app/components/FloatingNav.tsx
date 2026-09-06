import Link from "next/link";

type NavPage = "home" | "logs" | "progress" | "insights";

const items: { id: NavPage; href: string; icon: string; label: string }[] = [
  { id: "home", href: "/", icon: "◇", label: "Home" },
  { id: "logs", href: "/logs", icon: "≡", label: "Logs" },
  { id: "progress", href: "/progress", icon: "∿", label: "Progress" },
  { id: "insights", href: "/insights", icon: "✦", label: "Insights" },
];

export default function FloatingNav({ active }: { active: NavPage }) {
  return (
    <nav className="floating-nav" aria-label="Main pages">
      {items.map((item) => (
        <Link
          aria-current={active === item.id ? "page" : undefined}
          className={active === item.id ? "active" : ""}
          href={item.href}
          key={item.id}
        >
          <span aria-hidden="true"></span>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
