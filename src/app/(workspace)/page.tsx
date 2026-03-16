"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Advice, ProjectPost, readFromStorage, seedPosts, storageKeys } from "@/lib/ignit";
import styles from "./workspace.module.css";

export default function DashboardPage() {
  const [posts, setPosts] = useState<ProjectPost[]>(seedPosts);
  const [advice, setAdvice] = useState<Advice | null>(null);

  useEffect(() => {
    const savedPosts = readFromStorage<ProjectPost[]>(storageKeys.posts);
    const savedAdvice = readFromStorage<Advice>(storageKeys.advice);

    if (savedPosts?.length) {
      setPosts(savedPosts);
    }

    if (savedAdvice) {
      setAdvice(savedAdvice);
    }
  }, []);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Ignit 工作台</h1>
        <p className={styles.subtitle}>把启动阻力降到最低：一句话想法到 AI 策略，再到发帖找人。</p>
      </header>

      <section className={styles.grid3}>
        <article className={styles.stat}>
          <strong>{posts.length}</strong>
          <span>项目帖总数</span>
        </article>
        <article className={styles.stat}>
          <strong>{advice ? advice.recruitRoles.length : 0}</strong>
          <span>最近一次建议角色数</span>
        </article>
        <article className={styles.stat}>
          <strong>{advice ? "已生成" : "未生成"}</strong>
          <span>AI 启动建议状态</span>
        </article>
      </section>

      <section className={styles.grid2}>
        <article className={styles.panel}>
          <h2>下一步</h2>
          <div className={styles.actions}>
            <Link href="/launch" className={styles.primary}>
              去发起项目
            </Link>
            <Link href="/projects" className={styles.secondary}>
              去看项目流
            </Link>
            <Link href="/matches" className={styles.secondary}>
              去找协作者
            </Link>
          </div>
          <p className={styles.muted}>结构上像 Notion/GitHub：每个功能在独立页面，不再堆在一个页里。</p>
        </article>

        <article className={styles.panel}>
          <h2>最近项目帖</h2>
          <div className={styles.list}>
            {posts.slice(0, 3).map((post) => (
              <article key={post.id} className={styles.card}>
                <p>{post.idea}</p>
                <small>
                  {post.author} · {post.stage}
                </small>
              </article>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
