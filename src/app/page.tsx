"use client";

import { FormEvent, useMemo, useState } from "react";
import styles from "./page.module.css";

type Role = "产品" | "设计" | "前端" | "AI/后端" | "运营增长" | "内容";

type IdeaForm = {
  projectName: string;
  idea: string;
  targetUser: string;
  coreProblem: string;
  differentiation: string;
  firstWeekGoal: string;
  neededRoles: Role[];
};

type RecommendedPerson = {
  name: string;
  role: Role;
  strength: string;
};

type LaunchPlan = {
  summary: string;
  positioning: string;
  firstActions: string[];
  publishCopy: string;
  recommendations: RecommendedPerson[];
  completion: number;
};

type FeedProject = {
  id: number;
  name: string;
  summary: string;
  stage: string;
  roles: Role[];
  owner: string;
  createdAt: string;
};

const roleOptions: Role[] = ["产品", "设计", "前端", "AI/后端", "运营增长", "内容"];

const collaboratorPool: Record<Role, RecommendedPerson[]> = {
  产品: [
    { name: "Lena", role: "产品", strength: "擅长从 0 到 1 梳理问题与优先级" },
    { name: "Rei", role: "产品", strength: "用户访谈和需求抽象速度快" },
  ],
  设计: [
    { name: "Momo", role: "设计", strength: "能把复杂流程变成可用界面" },
    { name: "Ian", role: "设计", strength: "品牌气质和视觉系统搭建强" },
  ],
  前端: [
    { name: "Kai", role: "前端", strength: "高反馈速度原型与交互实现" },
    { name: "Nora", role: "前端", strength: "擅长 Next.js 与性能优化" },
  ],
  "AI/后端": [
    { name: "Zed", role: "AI/后端", strength: "结构化生成流程与数据建模" },
    { name: "Vivi", role: "AI/后端", strength: "RAG 与 API 编排落地经验" },
  ],
  "运营增长": [
    { name: "Pia", role: "运营增长", strength: "冷启动社群和种子用户增长" },
    { name: "Bo", role: "运营增长", strength: "活动运营和转化漏斗设计" },
  ],
  内容: [
    { name: "Arlo", role: "内容", strength: "擅长把产品价值讲清楚" },
    { name: "Jin", role: "内容", strength: "社媒内容节奏和选题敏感" },
  ],
};

const defaultForm: IdeaForm = {
  projectName: "",
  idea: "",
  targetUser: "",
  coreProblem: "",
  differentiation: "",
  firstWeekGoal: "",
  neededRoles: ["产品", "前端"],
};

const seedProjects: FeedProject[] = [
  {
    id: 1,
    name: "Campus Buddy",
    summary: "帮助大学生基于目标快速找到学习/项目搭子。",
    stage: "招募中",
    roles: ["前端", "内容"],
    owner: "Aiden",
    createdAt: "今天",
  },
  {
    id: 2,
    name: "Indie Sprint Board",
    summary: "给 side project 发起人提供 7 天启动看板。",
    stage: "验证中",
    roles: ["设计", "运营增长"],
    owner: "Mia",
    createdAt: "昨天",
  },
];

function buildPlan(form: IdeaForm): LaunchPlan {
  const filledFields = [
    form.projectName,
    form.idea,
    form.targetUser,
    form.coreProblem,
    form.differentiation,
    form.firstWeekGoal,
  ].filter((item) => item.trim().length > 0).length;

  const completion = Math.round((filledFields / 6) * 100);

  const summary = `${form.projectName || "未命名项目"}：${form.idea || "一个待定义的创意"}`;
  const positioning = `${form.targetUser || "目标用户"} 在 ${
    form.coreProblem || "某个关键问题"
  } 上存在明显痛点，我们用 ${form.differentiation || "更快可执行的方案"} 来完成第一版验证。`;

  const firstActions = [
    `今天：写出一句价值主张并发布到朋友圈/社群，收集 5 条真实反馈。`,
    `48 小时内：做一个最小落地页，核心只讲“为谁解决什么问题”。`,
    `7 天内：完成“${form.firstWeekGoal || "获取 10 位目标用户反馈"}”并复盘。`,
  ];

  const publishCopy = `我正在启动「${form.projectName || "这个项目"}」，需要 ${
    form.neededRoles.join(" / ") || "协作者"
  } 一起把第一版做出来。`;

  const recommendations = (form.neededRoles.length ? form.neededRoles : roleOptions)
    .flatMap((role) => collaboratorPool[role].slice(0, 1))
    .slice(0, 4);

  return {
    summary,
    positioning,
    firstActions,
    publishCopy,
    recommendations,
    completion,
  };
}

export default function Home() {
  const [form, setForm] = useState<IdeaForm>(defaultForm);
  const [plan, setPlan] = useState<LaunchPlan | null>(null);
  const [taskDone, setTaskDone] = useState<boolean[]>([]);
  const [feed, setFeed] = useState<FeedProject[]>(seedProjects);

  const progress = useMemo(() => {
    if (!taskDone.length) {
      return 0;
    }

    const finished = taskDone.filter(Boolean).length;
    return Math.round((finished / taskDone.length) * 100);
  }, [taskDone]);

  const onGenerate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const generated = buildPlan(form);
    setPlan(generated);
    setTaskDone(generated.firstActions.map(() => false));
  };

  const onPublish = () => {
    if (!plan) {
      return;
    }

    const newProject: FeedProject = {
      id: Date.now(),
      name: form.projectName || "未命名项目",
      summary: form.idea || "一个正在启动的项目",
      stage: "刚发布",
      roles: form.neededRoles,
      owner: "你",
      createdAt: new Date().toLocaleDateString("zh-CN"),
    };

    setFeed((current) => [newProject, ...current]);
  };

  const toggleRole = (role: Role) => {
    setForm((current) => {
      const exists = current.neededRoles.includes(role);
      if (exists) {
        return {
          ...current,
          neededRoles: current.neededRoles.filter((item) => item !== role),
        };
      }

      return {
        ...current,
        neededRoles: [...current.neededRoles, role],
      };
    });
  };

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <div>
          <p className={styles.brand}>IGNIT PRODUCT LAB</p>
          <h1>点火你的项目，不是浏览官网</h1>
        </div>
        <div className={styles.topStats}>
          <div>
            <strong>{feed.length}</strong>
            <span>项目流</span>
          </div>
          <div>
            <strong>{plan ? `${plan.completion}%` : "0%"}</strong>
            <span>想法清晰度</span>
          </div>
          <div>
            <strong>{progress}%</strong>
            <span>行动进度</span>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.workspace}>
          <form className={styles.panel} onSubmit={onGenerate}>
            <div className={styles.sectionHead}>
              <h2>1) 输入你的想法</h2>
              <p>先把模糊想法变成结构化信息。</p>
            </div>

            <label>
              项目名
              <input
                value={form.projectName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, projectName: event.target.value }))
                }
                placeholder="例如：Campus Buddy"
              />
            </label>

            <label>
              你想做什么
              <textarea
                value={form.idea}
                onChange={(event) =>
                  setForm((current) => ({ ...current, idea: event.target.value }))
                }
                placeholder="一句话描述你的想法"
              />
            </label>

            <div className={styles.twoCol}>
              <label>
                目标用户
                <input
                  value={form.targetUser}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, targetUser: event.target.value }))
                  }
                  placeholder="例如：大二到研一学生"
                />
              </label>
              <label>
                核心问题
                <input
                  value={form.coreProblem}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, coreProblem: event.target.value }))
                  }
                  placeholder="例如：找不到同频执行搭子"
                />
              </label>
            </div>

            <label>
              差异点
              <input
                value={form.differentiation}
                onChange={(event) =>
                  setForm((current) => ({ ...current, differentiation: event.target.value }))
                }
                placeholder="例如：72 小时内给出可执行结果"
              />
            </label>

            <label>
              第一周目标
              <input
                value={form.firstWeekGoal}
                onChange={(event) =>
                  setForm((current) => ({ ...current, firstWeekGoal: event.target.value }))
                }
                placeholder="例如：完成 10 个访谈 + 上线 waitlist"
              />
            </label>

            <fieldset>
              <legend>你需要的角色</legend>
              <div className={styles.roleGrid}>
                {roleOptions.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(role)}
                    className={
                      form.neededRoles.includes(role) ? styles.roleButtonActive : styles.roleButton
                    }
                  >
                    {role}
                  </button>
                ))}
              </div>
            </fieldset>

            <button className={styles.primaryCta} type="submit">
              2) 生成启动方案
            </button>
          </form>

          <section className={styles.panel}>
            <div className={styles.sectionHead}>
              <h2>2) 结构化输出</h2>
              <p>这块就是产品核心，不是展示文案。</p>
            </div>

            {plan ? (
              <>
                <article className={styles.outputCard}>
                  <h3>项目摘要</h3>
                  <p>{plan.summary}</p>
                </article>

                <article className={styles.outputCard}>
                  <h3>项目定位</h3>
                  <p>{plan.positioning}</p>
                </article>

                <article className={styles.outputCard}>
                  <h3>对外招募文案</h3>
                  <p>{plan.publishCopy}</p>
                </article>

                <button className={styles.secondaryCta} type="button" onClick={onPublish}>
                  发布到项目流
                </button>
              </>
            ) : (
              <p className={styles.emptyState}>填写左侧信息后点击“生成启动方案”，这里会出现可执行输出。</p>
            )}
          </section>
        </section>

        <section className={styles.lowerGrid}>
          <section className={styles.panel}>
            <div className={styles.sectionHead}>
              <h2>3) 行动推进</h2>
              <p>把复杂启动压缩成今天就能做的动作。</p>
            </div>
            {plan ? (
              <ul className={styles.todoList}>
                {plan.firstActions.map((task, index) => (
                  <li key={task}>
                    <label>
                      <input
                        type="checkbox"
                        checked={taskDone[index] ?? false}
                        onChange={() =>
                          setTaskDone((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? !item : item,
                            ),
                          )
                        }
                      />
                      <span>{task}</span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.emptyState}>生成方案后会自动出现前三步行动。</p>
            )}
          </section>

          <section className={styles.panel}>
            <div className={styles.sectionHead}>
              <h2>4) 协作推荐</h2>
              <p>按你选择的角色给出首批可连接对象。</p>
            </div>
            {plan ? (
              <div className={styles.peopleGrid}>
                {plan.recommendations.map((person) => (
                  <article key={`${person.name}-${person.role}`} className={styles.personCard}>
                    <h3>{person.name}</h3>
                    <span>{person.role}</span>
                    <p>{person.strength}</p>
                    <button type="button">邀请沟通</button>
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.emptyState}>先生成方案，再显示推荐协作者。</p>
            )}
          </section>
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionHead}>
            <h2>项目流（实时原型）</h2>
            <p>你发布的项目会立刻出现在这里，模拟社区冷启动。</p>
          </div>
          <div className={styles.feedGrid}>
            {feed.map((project) => (
              <article key={project.id} className={styles.feedCard}>
                <div className={styles.feedMeta}>
                  <h3>{project.name}</h3>
                  <span>{project.stage}</span>
                </div>
                <p>{project.summary}</p>
                <small>
                  需要角色：{project.roles.join(" / ")} · 发起人：{project.owner} · {project.createdAt}
                </small>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
