"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Advice,
  ProjectPost,
  buildAdvice,
  readFromStorage,
  seedPosts,
  storageKeys,
  writeToStorage,
} from "@/lib/ignit";
import styles from "./home.module.css";

export default function StartPage() {
  const [ideaInput, setIdeaInput] = useState("");
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [posts, setPosts] = useState<ProjectPost[]>(seedPosts);

  useEffect(() => {
    const savedPosts = readFromStorage<ProjectPost[]>(storageKeys.posts);
    const savedAdvice = readFromStorage<Advice>(storageKeys.advice);

    if (savedPosts?.length) {
      setPosts(savedPosts);
    }

    if (savedAdvice) {
      setAdvice(savedAdvice);
      setIdeaInput(savedAdvice.input);
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
      stage: "刚刚发布",
    };

    const nextPosts = [nextPost, ...posts];
    setPosts(nextPosts);
    writeToStorage(storageKeys.posts, nextPosts);
  };

  const recruiting = useMemo(
    () => posts.filter((post) => post.stage.includes("招募")).slice(0, 4),
    [posts],
  );

  const justPublished = useMemo(
    () => posts.filter((post) => post.stage.includes("刚")).slice(0, 4),
    [posts],
  );

  const updates = useMemo(
    () => posts.filter((post) => !post.stage.includes("招募") && !post.stage.includes("刚")).slice(0, 4),
    [posts],
  );

  const myPosts = useMemo(() => posts.filter((post) => post.author === "你").slice(0, 4), [posts]);

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <p className={styles.brand}>IGNIT</p>
        <p className={styles.definition}>AI 辅助的项目社交平台，让想法更快开始并找到人。</p>
      </header>

      <section className={styles.hero}>
        <h1>你想开始什么？</h1>
        <textarea
          value={ideaInput}
          onChange={(event) => setIdeaInput(event.target.value)}
          placeholder="比如：做一个帮助留学生找短租室友的平台"
        />
        <div className={styles.heroActions}>
          <button type="button" onClick={onGenerate}>
            AI 帮我整理
          </button>
          <Link href="/projects">浏览别人正在做的项目</Link>
          <button type="button" onClick={onPublish} className={styles.ghostAction}>
            发布成项目帖
          </button>
        </div>
      </section>

      <section className={styles.aiSection}>
        <div className={styles.sectionHead}>
          <h2>AI 会帮你输出什么</h2>
          <p>项目定位、执行路线、协作角色、第一周行动建议。</p>
        </div>
        <div className={styles.aiGrid}>
          <article className={styles.aiCard}>
            <h3>项目定位</h3>
            <p>
              {advice
                ? advice.refinedIdea
                : "输入一句话想法后，AI 会先把你的项目描述打磨成清晰版本。"}
            </p>
          </article>

          <article className={styles.aiCard}>
            <h3>执行路线</h3>
            <p>{advice ? advice.nextSteps[0] : "给你从今天就能开始做的第一步动作。"}</p>
          </article>

          <article className={styles.aiCard}>
            <h3>协作角色</h3>
            <p>{advice ? advice.recruitRoles.join(" / ") : "根据想法自动判断你最缺的协作角色。"}</p>
          </article>

          <article className={styles.aiCard}>
            <h3>第一周行动建议</h3>
            <p>{advice ? advice.nextSteps[2] : "压缩成 7 天可执行目标，减少拖延。"}</p>
          </article>
        </div>
      </section>

      <section className={styles.flowSection}>
        <div className={styles.sectionHead}>
          <h2>真实项目流 / 社区流</h2>
          <p>正在招募、刚刚发布、进展更新。</p>
        </div>

        <div className={styles.flowGrid}>
          <article className={styles.column}>
            <h3>正在招募</h3>
            <div className={styles.postList}>
              {recruiting.length ? (
                recruiting.map((post) => (
                  <article key={post.id} className={styles.postCard}>
                    <p>{post.idea}</p>
                    <small>{post.author}</small>
                  </article>
                ))
              ) : (
                <p className={styles.empty}>暂无</p>
              )}
            </div>
          </article>

          <article className={styles.column}>
            <h3>刚刚发布</h3>
            <div className={styles.postList}>
              {justPublished.length ? (
                justPublished.map((post) => (
                  <article key={post.id} className={styles.postCard}>
                    <p>{post.idea}</p>
                    <small>{post.author}</small>
                  </article>
                ))
              ) : (
                <p className={styles.empty}>暂无</p>
              )}
            </div>
          </article>

          <article className={styles.column}>
            <h3>进展更新</h3>
            <div className={styles.postList}>
              {updates.length ? (
                updates.map((post) => (
                  <article key={post.id} className={styles.postCard}>
                    <p>{post.idea}</p>
                    <small>{post.author}</small>
                  </article>
                ))
              ) : (
                <p className={styles.empty}>暂无</p>
              )}
            </div>
          </article>
        </div>
      </section>

      <section className={styles.mineSection}>
        <div className={styles.sectionHead}>
          <h2>你的项目</h2>
          <p>你发起的项目会先沉淀在这里，再进入持续协作。</p>
        </div>

        {myPosts.length ? (
          <div className={styles.mineList}>
            {myPosts.map((post) => (
              <article key={post.id} className={styles.mineCard}>
                <p>{post.idea}</p>
                <small>
                  {post.stage} · {post.createdAt}
                </small>
              </article>
            ))}
          </div>
        ) : (
          <p className={styles.empty}>你还没有发布项目，先在第一屏输入一句话开始。</p>
        )}
      </section>
    </div>
  );
}
