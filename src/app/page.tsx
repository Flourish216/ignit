import styles from "./page.module.css";

const quickActions = [
  {
    title: "发起一个项目",
    detail: "从 1 句话开始，公开你的目标、时间线和需要的人。",
    button: "新建项目",
  },
  {
    title: "找到搭子",
    detail: "按技能、城市和投入时间匹配合适合作伙伴。",
    button: "匹配协作者",
  },
  {
    title: "拓展朋友圈",
    detail: "通过真实协作建立信任，不再只是点赞关系。",
    button: "加入社区",
  },
];

const projects = [
  {
    name: "CityFarm Tracker",
    stage: "招募中",
    summary: "用 AI 记录城市阳台种植数据，帮新手少踩坑。",
    tags: ["AI", "SaaS", "环保"],
    members: "12 人关注",
  },
  {
    name: "Indie Dev Sprint",
    stage: "进行中",
    summary: "四周冲刺，做一个可上线的小产品并互相复盘。",
    tags: ["创业", "MVP", "增长"],
    members: "29 人参与",
  },
  {
    name: "Weekend Film Club",
    stage: "新发布",
    summary: "每周末拍 1 支 60 秒短片，摄影/剪辑/编剧都可加入。",
    tags: ["内容", "创意", "短视频"],
    members: "8 人加入",
  },
];

const people = [
  {
    name: "Lena",
    role: "产品经理",
    vibe: "擅长从 0 到 1 把点子落地",
  },
  {
    name: "Kai",
    role: "全栈开发",
    vibe: "喜欢做高反馈速度的原型",
  },
  {
    name: "Momo",
    role: "视觉设计",
    vibe: "能把复杂流程变成直观体验",
  },
];

export default function Home() {
  return (
    <div className={styles.page}>
      <header className={`${styles.topBar} ${styles.reveal}`}>
        <p className={styles.brand}>IGNIT</p>
        <nav className={styles.nav}>
          <a href="#projects">项目广场</a>
          <a href="#people">找朋友</a>
          <a className={styles.navButton} href="#launch">
            立即开始
          </a>
        </nav>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <p className={styles.badge}>Project-first social platform</p>
          <h1>
            在 Ignit，
            <br />
            从“想做点什么”到“有人一起做”。
          </h1>
          <p className={styles.heroText}>
            人们在这里发起项目、结识协作者、建立长期关系。社交不是空聊，而是一起把事情做成。
          </p>
          <div className={styles.heroActions}>
            <a className={styles.primaryAction} href="#launch">
              发布你的项目
            </a>
            <a className={styles.secondaryAction} href="#projects">
              先看看正在做什么
            </a>
          </div>
          <ul className={styles.stats}>
            <li>
              <strong>2.1k+</strong>
              <span>活跃项目</span>
            </li>
            <li>
              <strong>18k+</strong>
              <span>创作者</span>
            </li>
            <li>
              <strong>67%</strong>
              <span>持续协作率</span>
            </li>
          </ul>
        </section>

        <section className={styles.gridSection} id="launch">
          {quickActions.map((item, index) => (
            <article
              className={`${styles.infoCard} ${styles.reveal}`}
              key={item.title}
              style={{ animationDelay: `${index * 120}ms` }}
            >
              <h2>{item.title}</h2>
              <p>{item.detail}</p>
              <button type="button">{item.button}</button>
            </article>
          ))}
        </section>

        <section className={styles.feed} id="projects">
          <div className={styles.sectionHead}>
            <h2>正在发生的项目</h2>
            <a href="#">查看全部</a>
          </div>
          <div className={styles.projectList}>
            {projects.map((project, index) => (
              <article
                className={`${styles.projectCard} ${styles.reveal}`}
                key={project.name}
                style={{ animationDelay: `${120 + index * 120}ms` }}
              >
                <div className={styles.projectMeta}>
                  <h3>{project.name}</h3>
                  <span>{project.stage}</span>
                </div>
                <p>{project.summary}</p>
                <div className={styles.tags}>
                  {project.tags.map((tag) => (
                    <small key={tag}>{tag}</small>
                  ))}
                </div>
                <strong>{project.members}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.people} id="people">
          <div className={styles.sectionHead}>
            <h2>你可能会喜欢一起做事的人</h2>
            <a href="#">刷新推荐</a>
          </div>
          <div className={styles.peopleList}>
            {people.map((person, index) => (
              <article
                className={`${styles.personCard} ${styles.reveal}`}
                key={person.name}
                style={{ animationDelay: `${240 + index * 100}ms` }}
              >
                <div className={styles.avatar}>{person.name.slice(0, 1)}</div>
                <h3>{person.name}</h3>
                <span>{person.role}</span>
                <p>{person.vibe}</p>
                <button type="button">打个招呼</button>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
