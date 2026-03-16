import styles from "./page.module.css";

const frictionMap = [
  {
    title: "想法模糊",
    pain: "知道自己想做点什么，但讲不清要解决谁的问题。",
    igniteFix: "通过连续提问，把模糊冲动整理成可复述的项目定义。",
  },
  {
    title: "第一步卡住",
    pain: "不知道该先做页面、访谈、demo 还是先找人。",
    igniteFix: "给出前 3-5 个关键动作，避免陷入无限准备。",
  },
  {
    title: "找不到搭子",
    pain: "知道缺设计/开发/运营，但没有高效连接入口。",
    igniteFix: "围绕项目意图推荐角色，不做纯外包交易。",
  },
  {
    title: "热情流失",
    pain: "没有结构和行动切口，拖延会在一周内吞掉动力。",
    igniteFix: "把“我想做”变成“我今天就能做”的可执行清单。",
  },
];

const capabilities = [
  {
    title: "想法结构化",
    detail:
      "自然语言输入后，AI 追问用户、问题、差异点、第一步，输出标准化项目摘要。",
  },
  {
    title: "雏形生成",
    detail:
      "自动产出项目文档、Landing 文案、模块清单和阶段路线图，让人不再从空白页开始。",
  },
  {
    title: "协作匹配",
    detail:
      "根据项目需求推荐互补角色，把“我在启动什么、我需要谁”表达清楚并快速连接。",
  },
  {
    title: "行动推进",
    detail:
      "将复杂项目拆解为前 3-5 个动作，降低拖延概率，推动真实启动。",
  },
];

const roadmap = [
  {
    stage: "P0",
    goal: "验证需求",
    output: "Landing Page + 项目介绍 + 用户访谈",
    signal: "用户愿意留邮箱 / 进 waitlist",
  },
  {
    stage: "P1",
    goal: "可用原型",
    output: "输入想法 -> 输出摘要与下一步",
    signal: "用户愿意反复试用",
  },
  {
    stage: "P2",
    goal: "协作匹配",
    output: "项目发布页 + 角色需求页 + 搭子连接",
    signal: "出现真实连接与合作",
  },
  {
    stage: "P3",
    goal: "社区循环",
    output: "项目动态、展示页、更新 feed",
    signal: "用户自然分享项目",
  },
];

const roles = [
  "产品/创始人：负责方向、用户理解与对外沟通",
  "设计/前端：负责信息架构、品牌感与 web 原型",
  "AI/全栈执行：负责结构化流程、生成逻辑与数据层",
  "增长/社区：负责种子用户、分发策略与反馈闭环",
];

const risks = [
  {
    risk: "概念听起来好，但不一定持续使用",
    action: "先打磨最强单点价值：帮用户开始。",
  },
  {
    risk: "产品容易做重，滑向项目管理工具",
    action: "前期只聚焦启动场景，不做全功能管理。",
  },
  {
    risk: "匹配功能冷启动难",
    action: "先从项目展示 + 人工精选连接切入。",
  },
  {
    risk: "AI 输出同质化",
    action: "强化引导流程、模板深度与场景化策略。",
  },
];

export default function Home() {
  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <p className={styles.brand}>IGNIT</p>
        <nav className={styles.nav}>
          <a href="#studio">AI 启动台</a>
          <a href="#roadmap">产品路线</a>
          <a href="#join">加入我们</a>
        </nav>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <div>
            <p className={styles.kicker}>Human-first, AI-assisted</p>
            <h1>把“我想做”点燃成“我已经开始做了”。</h1>
            <p className={styles.heroText}>
              Ignit 把项目最难的启动时刻拆开处理：先说清想法，再生成雏形，再找到人一起做。不是管理已经存在的项目，而是让项目真的开始。
            </p>
            <div className={styles.heroActions}>
              <a href="#studio" className={styles.primaryAction}>
                进入点火流程
              </a>
              <a href="#roadmap" className={styles.secondaryAction}>
                看 P0-P3 路线
              </a>
            </div>
          </div>

          <aside className={styles.heroPanel}>
            <p className={styles.panelTitle}>Ignition Signal</p>
            <ul>
              <li>
                <strong>Stage Focus</strong>
                <span>项目启动前 72 小时</span>
              </li>
              <li>
                <strong>Core Outcome</strong>
                <span>第一版可行动成果</span>
              </li>
              <li>
                <strong>North Star</strong>
                <span>从模糊念头到首个公开动作</span>
              </li>
            </ul>
          </aside>
        </section>

        <section className={styles.block}>
          <div className={styles.blockHead}>
            <h2>启动阻力地图</h2>
            <p>Ignit 不做笼统“效率工具”，只砍掉最容易让想法死掉的四类摩擦。</p>
          </div>
          <div className={styles.frictionGrid}>
            {frictionMap.map((item) => (
              <article key={item.title} className={styles.card}>
                <h3>{item.title}</h3>
                <p>{item.pain}</p>
                <small>Ignit 解法：{item.igniteFix}</small>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.block} id="studio">
          <div className={styles.blockHead}>
            <h2>AI 启动台（示意）</h2>
            <p>不是聊天结束，而是结构化结果开始。</p>
          </div>
          <div className={styles.console}>
            <article className={styles.consoleCard}>
              <p className={styles.consoleTitle}>01 原始输入</p>
              <p className={styles.consoleText}>“我想做一个给大学生找搭子的社交平台。”</p>
            </article>

            <article className={styles.consoleCard}>
              <p className={styles.consoleTitle}>02 Ignit 追问</p>
              <ul className={styles.list}>
                <li>主要服务哪类大学生？大一新生还是实习党？</li>
                <li>当前他们最难的是找学习搭子还是副业搭子？</li>
                <li>你和现有平台相比最大的差异点是什么？</li>
                <li>第一周最小验证动作是什么？</li>
              </ul>
            </article>

            <article className={styles.consoleCard}>
              <p className={styles.consoleTitle}>03 结构化输出</p>
              <ul className={styles.list}>
                <li>项目定位：校园内可信协作连接平台</li>
                <li>核心用户：大二-研一有执行目标的学生</li>
                <li>核心问题：无法快速找到同频执行搭子</li>
                <li>第一步：上线 waitlist 页并访谈 10 位用户</li>
              </ul>
            </article>
          </div>
        </section>

        <section className={styles.block}>
          <div className={styles.blockHead}>
            <h2>核心能力栈</h2>
            <p>每个能力都服务“启动成功率”，而不是功能堆砌。</p>
          </div>
          <div className={styles.capabilityGrid}>
            {capabilities.map((item) => (
              <article key={item.title} className={styles.card}>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.block} id="roadmap">
          <div className={styles.blockHead}>
            <h2>第一阶段产品路线</h2>
            <p>从验证需求到社区循环，逐步扩而不是一次做满。</p>
          </div>
          <div className={styles.roadmapGrid}>
            {roadmap.map((item) => (
              <article key={item.stage} className={styles.phaseCard}>
                <p className={styles.phase}>{item.stage}</p>
                <h3>{item.goal}</h3>
                <p>{item.output}</p>
                <small>成功信号：{item.signal}</small>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.block} id="join">
          <div className={styles.blockHead}>
            <h2>正在寻找的共创角色</h2>
            <p>如果你也对“启动阻力”有共鸣，我们一起把它做成产品。</p>
          </div>
          <div className={styles.joinPanel}>
            <ul className={styles.list}>
              {roles.map((role) => (
                <li key={role}>{role}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className={styles.block}>
          <div className={styles.blockHead}>
            <h2>当前风险与应对</h2>
            <p>有风险没问题，关键是提前定义策略。</p>
          </div>
          <div className={styles.riskGrid}>
            {risks.map((item) => (
              <article key={item.risk} className={styles.riskCard}>
                <p>{item.risk}</p>
                <small>{item.action}</small>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
