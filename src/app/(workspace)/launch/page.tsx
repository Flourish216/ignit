"use client";

import { useEffect, useState } from "react";
import {
  Advice,
  ProjectPost,
  buildAdvice,
  readFromStorage,
  seedPosts,
  storageKeys,
  writeToStorage,
} from "@/lib/ignit";
import styles from "../workspace.module.css";

export default function LaunchPage() {
  const [ideaInput, setIdeaInput] = useState("");
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [posts, setPosts] = useState<ProjectPost[]>(seedPosts);

  useEffect(() => {
    const savedAdvice = readFromStorage<Advice>(storageKeys.advice);
    const savedPosts = readFromStorage<ProjectPost[]>(storageKeys.posts);

    if (savedAdvice) {
      setAdvice(savedAdvice);
      setIdeaInput(savedAdvice.input);
    }

    if (savedPosts?.length) {
      setPosts(savedPosts);
    }
  }, []);

  const onGenerate = () => {
    if (!ideaInput.trim()) {
      return;
    }

    const nextAdvice = buildAdvice(ideaInput);
    setAdvice(nextAdvice);
    writeToStorage(storageKeys.advice, nextAdvice);
  };

  const onPublish = () => {
    if (!advice) {
      return;
    }

    const nextPost: ProjectPost = {
      id: Date.now(),
      idea: advice.refinedIdea,
      author: "你",
      createdAt: advice.createdAt,
      roles: advice.recruitRoles,
      stage: "刚发布",
    };

    const nextPosts = [nextPost, ...posts];
    setPosts(nextPosts);
    writeToStorage(storageKeys.posts, nextPosts);
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>发起项目</h1>
        <p className={styles.subtitle}>一句话输入想法，AI 立即给出启动策略和招募方向。</p>
      </header>

      <section className={styles.grid2}>
        <article className={styles.panel}>
          <h2>自然语言入口</h2>
          <textarea
            className={styles.textarea}
            value={ideaInput}
            onChange={(event) => setIdeaInput(event.target.value)}
            placeholder="例如：我想做一个帮助大学生找到项目搭子的社交平台"
          />
          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={onGenerate}>
              AI 帮我出谋划策
            </button>
            <button type="button" className={styles.secondary} onClick={onPublish}>
              发布到项目流
            </button>
          </div>
          <p className={styles.muted}>发帖后去“项目流”页看完整列表。</p>
        </article>

        <article className={styles.panel}>
          <h2>AI 输出</h2>
          {advice ? (
            <div className={styles.list}>
              <article className={styles.card}>
                <p>{advice.refinedIdea}</p>
              </article>
              <article className={styles.card}>
                <small>建议招募角色：{advice.recruitRoles.join(" / ")}</small>
              </article>
              <article className={styles.card}>
                <p>{advice.recruitPost}</p>
              </article>
              <article className={styles.card}>
                <small>{advice.nextSteps.join(" ")}</small>
              </article>
            </div>
          ) : (
            <p className={styles.muted}>点击左侧按钮后，这里出现建议。</p>
          )}
        </article>
      </section>
    </div>
  );
}
