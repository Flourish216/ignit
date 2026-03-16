"use client";

import { useMemo, useState } from "react";
import styles from "./page.module.css";

type Role = "产品" | "设计" | "前端" | "AI/后端" | "运营增长" | "内容";

type Advice = {
  refinedIdea: string;
  recruitRoles: Role[];
  nextSteps: string[];
  recruitPost: string;
};

type ProjectPost = {
  id: number;
  idea: string;
  author: string;
  createdAt: string;
  roles: Role[];
  stage: string;
};

type Match = {
  name: string;
  role: Role;
  note: string;
};

const rolePool: Record<Role, Match[]> = {
  产品: [
    { name: "Lena", role: "产品", note: "擅长把模糊想法收敛成 MVP。" },
    { name: "Noah", role: "产品", note: "有校园项目冷启动经验。" },
  ],
  设计: [
    { name: "Momo", role: "设计", note: "擅长信息架构和简洁交互。" },
    { name: "Ian", role: "设计", note: "品牌感和首版 landing 速度快。" },
  ],
  前端: [
    { name: "Kai", role: "前端", note: "Next.js 原型开发速度快。" },
    { name: "Rex", role: "前端", note: "擅长移动端与响应式细节。" },
  ],
  "AI/后端": [
    { name: "Zed", role: "AI/后端", note: "结构化流程和 API 编排落地强。" },
    { name: "Vivi", role: "AI/后端", note: "擅长快速做可验证 AI 功能。" },
  ],
  "运营增长": [
    { name: "Pia", role: "运营增长", note: "可帮你找到首批种子用户。" },
    { name: "Bo", role: "运营增长", note: "能做首轮内容分发和转化。" },
  ],
  内容: [
    { name: "Arlo", role: "内容", note: "把项目价值讲清楚很快。" },
    { name: "Jin", role: "内容", note: "社媒文案和叙事结构成熟。" },
  ],
};

const seedPosts: ProjectPost[] = [
  {
    id: 1,
    idea: "做一个帮助大学生找项目搭子的轻社交平台。",
    author: "Aiden",
    createdAt: "今天",
    roles: ["前端", "运营增长"],
    stage: "招募中",
  },
  {
    id: 2,
    idea: "做一个 side project 发起人的公开进度墙。",
    author: "Mia",
    createdAt: "昨天",
    roles: ["设计", "内容"],
    stage: "验证中",
  },
];

function inferRoles(text: string): Role[] {
  const source = text.toLowerCase();
  const picked = new Set<Role>();

  if (/社交|社区|用户|增长|传播/.test(source)) {
    picked.add("运营增长");
  }

  if (/网站|平台|app|应用|工具|开发|功能/.test(source)) {
    picked.add("前端");
    picked.add("AI/后端");
  }

  if (/设计|界面|体验|品牌|视觉/.test(source)) {
    picked.add("设计");
  }

  if (/内容|文案|视频|播客|文章/.test(source)) {
    picked.add("内容");
  }

  picked.add("产品");

  return Array.from(picked).slice(0, 3);
}

function buildAdvice(text: string): Advice {
  const cleaned = text.trim().replace(/。+$/g, "");
  const roles = inferRoles(cleaned);
  const refinedIdea = `${cleaned}。先做最小可验证版本，重点验证“是否有人愿意一起做”。`;

  return {
    refinedIdea,
    recruitRoles: roles,
    nextSteps: [
      "今天发布项目帖：写清你在做什么、为什么现在做、需要谁。",
      "48 小时内私聊 5 位潜在协作者，确认他们愿不愿意投入一周。",
      "7 天内做出可见成果（demo / landing / 社群），并在项目流更新进展。",
    ],
    recruitPost: `我正在做：${cleaned}。目前在找 ${roles.join(" / ")}，想一起把第一版尽快做出来。`,
  };
}

export default function Home() {
  const [ideaInput, setIdeaInput] = useState("");
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [posts, setPosts] = useState<ProjectPost[]>(seedPosts);

  const matches = useMemo(() => {
    if (!advice) {
      return [];
    }

    return advice.recruitRoles.flatMap((role) => rolePool[role].slice(0, 1)).slice(0, 4);
  }, [advice]);

  const onGenerate = () => {
    if (!ideaInput.trim()) {
      return;
    }

    setAdvice(buildAdvice(ideaInput));
  };

  const onPublish = () => {
    if (!advice) {
      return;
    }

    const post: ProjectPost = {
      id: Date.now(),
      idea: advice.refinedIdea,
      author: "你",
      createdAt: new Date().toLocaleDateString("zh-CN"),
      roles: advice.recruitRoles,
      stage: "刚发布",
    };

    setPosts((current) => [post, ...current]);
  };

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <p className={styles.brand}>IGNIT</p>
        <h1>一句话发起项目，AI 帮你找人和开局。</h1>
        <p className={styles.subline}>
          这里发的不是普通帖子，而是“项目帖”：你在做什么、卡在哪、需要谁。
        </p>
      </header>

      <main className={styles.main}>
        <section className={styles.leftCol}>
          <section className={styles.panel}>
            <h2>发起一个项目帖</h2>
            <p className={styles.muted}>只用一句自然语言描述你的想法。</p>
            <textarea
              value={ideaInput}
              onChange={(event) => setIdeaInput(event.target.value)}
              placeholder="例如：我想做一个让大学生更容易找到项目搭子的平台"
            />
            <div className={styles.actions}>
              <button type="button" onClick={onGenerate} className={styles.primaryBtn}>
                AI 帮我出谋划策
              </button>
              <button type="button" onClick={onPublish} className={styles.secondaryBtn}>
                发布项目帖
              </button>
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.rowHead}>
              <h2>项目流</h2>
              <span>{posts.length} 个项目</span>
            </div>
            <div className={styles.feedList}>
              {posts.map((post) => (
                <article className={styles.postCard} key={post.id}>
                  <div className={styles.postMeta}>
                    <strong>{post.author}</strong>
                    <span>{post.stage}</span>
                  </div>
                  <p>{post.idea}</p>
                  <small>
                    需要角色：{post.roles.join(" / ")} · {post.createdAt}
                  </small>
                </article>
              ))}
            </div>
          </section>
        </section>

        <section className={styles.rightCol}>
          <section className={styles.panel}>
            <h2>AI 启动建议</h2>
            {advice ? (
              <>
                <article className={styles.block}>
                  <h3>优化后项目描述</h3>
                  <p>{advice.refinedIdea}</p>
                </article>
                <article className={styles.block}>
                  <h3>建议招募角色</h3>
                  <p>{advice.recruitRoles.join(" / ")}</p>
                </article>
                <article className={styles.block}>
                  <h3>下一步行动</h3>
                  <ul>
                    {advice.nextSteps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                </article>
                <article className={styles.block}>
                  <h3>可直接发的招募文案</h3>
                  <p>{advice.recruitPost}</p>
                </article>
              </>
            ) : (
              <p className={styles.muted}>点“AI 帮我出谋划策”后，这里会生成你的启动方案。</p>
            )}
          </section>

          <section className={styles.panel}>
            <div className={styles.rowHead}>
              <h2>推荐可聊的人</h2>
              <span>AI 按角色匹配</span>
            </div>
            {matches.length ? (
              <div className={styles.matchList}>
                {matches.map((person) => (
                  <article className={styles.matchCard} key={`${person.name}-${person.role}`}>
                    <strong>{person.name}</strong>
                    <span>{person.role}</span>
                    <p>{person.note}</p>
                    <button type="button">打招呼</button>
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.muted}>先让 AI 读一下你的想法，再给你推荐搭子。</p>
            )}
          </section>
        </section>
      </main>
    </div>
  );
}
