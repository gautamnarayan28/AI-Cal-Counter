import Link from "next/link";
import Image from "next/image";

type NavPage = "home" | "logs" | "progress" | "insights";

const items: { id: NavPage; href: string; label: string }[] = [
  { id: "home", href: "/", label: "Home" },
  { id: "logs", href: "/logs", label: "Logs" },
  { id: "progress", href: "/progress", label: "Progress" },
  { id: "insights", href: "/insights", label: "Insights" },
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
          <span className="dock-art" aria-hidden="true">
            <Image src={item.id === "home" ? "/icons/home-reworked.png" : `/icons/${item.id}.png`} className={item.id === "home" ? "dock-home-art" : undefined} alt="" width={84} height={84} unoptimized />
          </span>
          <span className="dock-label">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
