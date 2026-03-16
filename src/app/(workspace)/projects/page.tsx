"use client";

import { useEffect, useState } from "react";
import {
  Advice,
  ProjectPost,
  readFromStorage,
  seedPosts,
  storageKeys,
  writeToStorage,
} from "@/lib/ignit";
import styles from "../workspace.module.css";

export default function ProjectsPage() {
  const [posts, setPosts] = useState<ProjectPost[]>(seedPosts);
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [quickIdea, setQuickIdea] = useState("");

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

  const appendPost = (post: ProjectPost) => {
    const nextPosts = [post, ...posts];
    setPosts(nextPosts);
    writeToStorage(storageKeys.posts, nextPosts);
  };

  const onQuickPost = () => {
    if (!quickIdea.trim()) {
      return;
    }

    appendPost({
      id: Date.now(),
      idea: quickIdea.trim(),
      author: "你",
      createdAt: new Intl.DateTimeFormat("zh-CN").format(new Date()),
      roles: ["产品", "前端"],
      stage: "刚发布",
    });

    setQuickIdea("");
  };

  const publishFromAdvice = () => {
    if (!advice) {
      return;
    }

    appendPost({
      id: Date.now(),
      idea: advice.refinedIdea,
      author: "你",
      createdAt: advice.createdAt,
      roles: advice.recruitRoles,
      stage: "刚发布",
    });
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>项目流</h1>
        <p className={styles.subtitle}>这里是 Ignit 的核心社交流：每条内容都是“项目帖”。</p>
      </header>

      <section className={styles.grid2}>
        <article className={styles.panel}>
          <h2>快速发帖</h2>
          <input
            className={styles.input}
            value={quickIdea}
            onChange={(event) => setQuickIdea(event.target.value)}
            placeholder="一句话写你在启动什么项目"
          />
          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={onQuickPost}>
              发布
            </button>
            <button type="button" className={styles.secondary} onClick={publishFromAdvice}>
              用 AI 结果发布
            </button>
          </div>
          <p className={styles.muted}>建议先去“发起项目”生成 AI 建议，再回来发布。</p>
        </article>

        <article className={styles.panel}>
          <h2>流内项目</h2>
          <div className={styles.list}>
            {posts.map((post) => (
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
                  {post.author} · {post.stage} · {post.createdAt}
                </small>
              </article>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
