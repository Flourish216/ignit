export type Language = 'en' | 'zh'

export const translations = {
  en: {
    nav: { home: 'Home', explore: 'Explore', teams: 'Teams', newProject: 'New Project', signIn: 'Sign In', getStarted: 'Get Started' },
    hero: { badge: 'Human-first, AI-assisted', title: 'Turn your ideas into', titleHighlight: 'collaborative projects', description: 'Describe what you want to build. Our AI will help break it down into actionable tasks.' },
    features: { title: 'How it works', subtitle: 'From idea to reality in four simple steps', shareIdea: { title: 'Share Your Idea', description: 'Describe your project in plain language.' }, aiBreakdown: { title: 'AI Breakdown', description: 'Our AI analyzes your idea and creates a plan.' }, findTeam: { title: 'Find Your Team', description: 'Connect with talented people.' }, buildTogether: { title: 'Build Together', description: 'Work together in dedicated team spaces.' } },
    cta: { title: 'Ready to start building?', subtitle: 'Join thousands of creators turning their ideas into reality', exploreProjects: 'Explore Projects', createAccount: 'Create Account' },
    footer: 'Built with collaboration in mind. Powered by AI.',
    language: 'Language',
  },
  zh: {
    nav: { home: '首页', explore: '探索', teams: '团队', newProject: '新建项目', signIn: '登录', getStarted: '开始使用' },
    hero: { badge: '以人为本，AI 辅助', title: '将你的创意转化为', titleHighlight: '协作项目', description: '描述你想构建的内容。我们的 AI 将帮助将其分解为可执行的任务。' },
    features: { title: '工作原理', subtitle: '四个简单步骤，从创意到现实', shareIdea: { title: '分享你的创意', description: '用简单的语言描述你的项目。' }, aiBreakdown: { title: 'AI 智能拆解', description: '我们的 AI 分析你的创意，创建项目计划。' }, findTeam: { title: '寻找团队', description: '与优秀人才建立联系。' }, buildTogether: { title: '协作共建', description: '在专属的团队空间中协同工作。' } },
    cta: { title: '准备好开始构建了吗？', subtitle: '加入数千名创作者，将创意变为现实', exploreProjects: '探索项目', createAccount: '创建账户' },
    footer: '以协作为核心，由 AI 驱动。',
    language: '语言',
  },
}

export type Translations = typeof translations.en
