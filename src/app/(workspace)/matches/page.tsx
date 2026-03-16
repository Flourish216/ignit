"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Advice,
  Match,
  ProjectPost,
  readFromStorage,
  rolePool,
  seedPosts,
  storageKeys,
} from "@/lib/ignit";
import styles from "../workspace.module.css";

export default function MatchesPage() {
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [posts, setPosts] = useState<ProjectPost[]>(seedPosts);

  useEffect(() => {
    const savedAdvice = readFromStorage<Advice>(storageKeys.advice);
    const savedPosts = readFromStorage<ProjectPost[]>(storageKeys.posts);

    if (savedAdvice) {
      setAdvice(savedAdvice);
    }

    if (savedPosts?.length) {
      setPosts(savedPosts);
    }
  }, []);

  const matches = useMemo<Match[]>(() => {
    if (!advice) {
      return [];
    }

    return advice.recruitRoles.flatMap((role) => rolePool[role].slice(0, 2)).slice(0, 6);
  }, [advice]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>找人</h1>
        <p className={styles.subtitle}>AI 根据你的项目意图推荐可连接的人，而不是泛泛“找外包”。</p>
      </header>

      <section className={styles.grid2}>
        <article className={styles.panel}>
          <h2>推荐协作者</h2>
          {matches.length ? (
            <div className={styles.list}>
              {matches.map((person) => (
                <article key={`${person.name}-${person.role}`} className={styles.card}>
                  <p>
                    <strong>{person.name}</strong> · {person.role}
                  </p>
                  <small>{person.note}</small>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.list}>
              <p className={styles.muted}>你还没有生成 AI 建议，暂时无法做精准推荐。</p>
              <Link href="/launch" className={styles.primary}>
                去发起项目并生成建议
              </Link>
            </div>
          )}
        </article>

        <article className={styles.panel}>
          <h2>最近项目帖需要的人</h2>
          <div className={styles.list}>
            {posts.slice(0, 5).map((post) => (
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
