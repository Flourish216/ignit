"use client";

import { useEffect, useMemo, useState } from "react";
import { ProjectPost, readFromStorage, seedPosts, storageKeys } from "@/lib/ignit";
import styles from "../workspace.module.css";

export default function MyProjectsPage() {
  const [posts, setPosts] = useState<ProjectPost[]>(seedPosts);

  useEffect(() => {
    const savedPosts = readFromStorage<ProjectPost[]>(storageKeys.posts);
    if (savedPosts?.length) {
      setPosts(savedPosts);
    }
  }, []);

  const myPosts = useMemo(() => posts.filter((post) => post.author === "你"), [posts]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>我的项目</h1>
        <p className={styles.subtitle}>你发布过的项目帖都在这里，后续可以扩展成进度管理与协作面板。</p>
      </header>

      <section className={styles.panel}>
        <h2>我发起的项目</h2>
        {myPosts.length ? (
          <div className={styles.list}>
            {myPosts.map((post) => (
              <article key={post.id} className={styles.card}>
                <p>{post.idea}</p>
                <div className={styles.tags}>
                  {post.roles.map((role) => (
                    <span key={role} className={styles.tag}>
                      {role}
                    </span>
                  ))}
                </div>
                <small>
                  {post.stage} · {post.createdAt}
                </small>
              </article>
            ))}
          </div>
        ) : (
          <p className={styles.muted}>你还没有发布项目，先去“发起项目”用一句话开始。</p>
        )}
      </section>
    </div>
  );
}
