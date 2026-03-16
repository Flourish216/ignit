"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./workspace-shell.module.css";

const navItems = [
  { href: "/", label: "开始" },
  { href: "/projects", label: "发现项目" },
  { href: "/launch", label: "发起项目" },
  { href: "/matches", label: "协作者" },
  { href: "/my", label: "我的项目" },
];

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className={styles.app}>
      <aside className={styles.sidebar}>
        <div>
          <p className={styles.brand}>IGNIT</p>
          <p className={styles.caption}>让项目更快开始的社交平台</p>
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
          <strong>先发起，再连接</strong>
          <p>在“发起项目”输入一句自然语言，AI 会帮你整理方向并推荐协作者。</p>
        </div>
      </aside>

      <section className={styles.content}>{children}</section>
    </div>
  );
}
