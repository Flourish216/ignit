"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./workspace-shell.module.css";

const navItems = [
  { href: "/", label: "总览" },
  { href: "/launch", label: "发起项目" },
  { href: "/projects", label: "项目流" },
  { href: "/matches", label: "找人" },
];

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className={styles.app}>
      <aside className={styles.sidebar}>
        <div>
          <p className={styles.brand}>IGNIT</p>
          <p className={styles.caption}>Project-first social app</p>
        </div>

        <nav className={styles.nav}>
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} className={active ? styles.active : styles.link}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className={styles.tip}>
          <strong>一句话就开始</strong>
          <p>先在“发起项目”输入自然语言，AI 会给你第一版策略与招募建议。</p>
        </div>
      </aside>

      <section className={styles.content}>{children}</section>
    </div>
  );
}
