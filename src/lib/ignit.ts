export type Role = "产品" | "设计" | "前端" | "AI/后端" | "运营增长" | "内容";

export type Advice = {
  input: string;
  refinedIdea: string;
  recruitRoles: Role[];
  nextSteps: string[];
  recruitPost: string;
  createdAt: string;
};

export type ProjectPost = {
  id: number;
  idea: string;
  author: string;
  createdAt: string;
  roles: Role[];
  stage: string;
};

export type Match = {
  name: string;
  role: Role;
  note: string;
};

export const rolePool: Record<Role, Match[]> = {
  产品: [
    { name: "Lena", role: "产品", note: "擅长把模糊需求收敛成 MVP。" },
    { name: "Noah", role: "产品", note: "做过多个校园社区冷启动。" },
  ],
  设计: [
    { name: "Momo", role: "设计", note: "信息架构和交互路径清晰。" },
    { name: "Ian", role: "设计", note: "首版品牌和 landing 速度快。" },
  ],
  前端: [
    { name: "Kai", role: "前端", note: "Next.js 原型落地快。" },
    { name: "Rex", role: "前端", note: "移动端和响应式细节扎实。" },
  ],
  "AI/后端": [
    { name: "Zed", role: "AI/后端", note: "擅长 AI 功能快速验证。" },
    { name: "Vivi", role: "AI/后端", note: "结构化流程和 API 经验丰富。" },
  ],
  "运营增长": [
    { name: "Pia", role: "运营增长", note: "可以帮你找首批种子用户。" },
    { name: "Bo", role: "运营增长", note: "擅长社群和内容分发。" },
  ],
  内容: [
    { name: "Arlo", role: "内容", note: "把项目价值讲清楚很快。" },
    { name: "Jin", role: "内容", note: "社媒叙事和文案结构强。" },
  ],
};

export const seedPosts: ProjectPost[] = [
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

const dateFormatter = new Intl.DateTimeFormat("zh-CN");

export function inferRoles(text: string): Role[] {
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

export function buildAdvice(input: string): Advice {
  const cleaned = input.trim().replace(/。+$/g, "");
  const roles = inferRoles(cleaned);

  return {
    input: cleaned,
    refinedIdea: `${cleaned}。先用最小可验证版本确认“是否有人愿意一起做”。`,
    recruitRoles: roles,
    nextSteps: [
      "今天发项目帖：写清你在做什么、为什么现在做、需要谁。",
      "48 小时内联系 5 位潜在协作者，确认愿不愿意投入一周。",
      "7 天内交付一个可见成果（demo / landing / 社群）并公开更新。",
    ],
    recruitPost: `我正在做：${cleaned}。目前需要 ${roles.join(" / ")} 一起把第一版尽快做出来。`,
    createdAt: dateFormatter.format(new Date()),
  };
}

export const storageKeys = {
  posts: "ignit:posts:v1",
  advice: "ignit:advice:v1",
};

export function readFromStorage<T>(key: string): T | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const value = window.localStorage.getItem(key);
    if (!value) {
      return null;
    }

    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function writeToStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}
