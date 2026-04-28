import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const { idea } = await request.json()

  if (!idea) {
    return new Response("Idea is required", { status: 400 })
  }

  // Check if user is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return new Response("Unauthorized", { status: 401 })
  }

  const apiKey = process.env.GLM_API_KEY
  if (!apiKey) {
    return new Response("GLM API key not configured", { status: 500 })
  }

  try {
    // Detect input language
    const isChinese = /[\u4e00-\u9fa5]/.test(idea)

    const responseLanguage = isChinese ? "Simplified Chinese" : "English"
    const userPrompt = isChinese
      ? `请帮我整理这个项目想法："${idea}"。\n\n请从以下几个角度分析：\n1. 这个项目在解决什么问题？\n2. 面向什么用户群体？\n3. 一句话概括这个项目是什么？\n4. 第一版 MVP 应该包含什么？\n5. 最初 7 天可以怎么推进？\n\n请用 JSON 格式返回完整项目规划。JSON 的字段名必须保持英文，字段内容请使用简体中文。`
      : `Please help me structure this project idea: "${idea}". Analyze and respond in English. Keep the JSON field names exactly as requested and write all content values in English.`

    const systemPrompt = `You are a project planning assistant for a collaborative platform where anyone — not just developers — can launch and grow their ideas. Projects can be apps, content series, community initiatives, physical products, social enterprises, creative works, educational programs, and more.

Your goal is to help users turn a vague idea into a clear, collaborative project.

CRITICAL: Respond in ${responseLanguage}. Keep all JSON field names in English exactly as specified, but write all user-facing content values in ${responseLanguage}.

When given a project idea, analyze and structure it into:

1. **one_liner**: One sentence that captures the core value proposition (under 30 words)
2. **title**: A clear, concise project title (max 60 characters)
3. **description**: A detailed description (2-3 sentences explaining what and why)
4. **problem**: What specific problem this project solves
5. **target_users**: Who is this project for (specific user groups)
6. **mvp**: What the minimum viable first version should include (3-5 items)
7. **first_week**: A 7-day action plan with daily goals
8. **milestones**: Key milestones (3-5) with estimated timeframes
9. **roles**: Required team roles with specific skills needed. IMPORTANT: roles should reflect the actual nature of the project — for a content or community project they might be Writer, Community Manager, Designer; for a social enterprise, Researcher, Fundraiser, Program Coordinator; for a tech product, only then Frontend Developer etc. Do NOT default to technical roles unless the project truly needs them.
10. **challenges**: Potential challenges and how to address them

IMPORTANT: Your response should help someone understand the project at a glance and decide if they want to join.

Respond ONLY in valid JSON format with these exact keys:
{
  "one_liner": "One sentence project summary",
  "title": "Project Title",
  "description": "Detailed description of the project",
  "problem": "What problem this solves",
  "target_users": "Who this is for",
  "mvp": ["Feature 1", "Feature 2", "Feature 3", "Feature 4", "Feature 5"],
  "first_week": [
    { "day": "Day 1", "goal": "What to accomplish" },
    { "day": "Day 2", "goal": "What to accomplish" },
    { "day": "Day 3", "goal": "What to accomplish" },
    { "day": "Day 4", "goal": "What to accomplish" },
    { "day": "Day 5", "goal": "What to accomplish" },
    { "day": "Day 6", "goal": "What to accomplish" },
    { "day": "Day 7", "goal": "What to accomplish" }
  ],
  "milestones": [
    { "name": "Milestone name", "description": "What needs to be done", "timeframe": "1-2 weeks" }
  ],
  "roles": [
    { "title": "Role title", "skills": ["skill1", "skill2"], "description": "What this person will do" }
  ],
  "challenges": [
    { "challenge": "Description of challenge", "solution": "How to address it" }
  ]
}`

    const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "glm-4-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("GLM API error:", errorText)
      return new Response(`AI service error: ${response.status}`, { status: 502 })
    }

    const data = await response.json()
    const aiContent = data.choices?.[0]?.message?.content

    if (!aiContent) {
      return new Response("Invalid AI response", { status: 502 })
    }

    // Extract JSON from the response
    const jsonMatch = aiContent.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return new Response("Failed to parse AI response", { status: 502 })
    }

    // Validate it's valid JSON
    const parsed = JSON.parse(jsonMatch[0])

    return Response.json({ result: parsed })
  } catch (error) {
    console.error("Error calling GLM API:", error)
    return new Response("Failed to analyze idea", { status: 500 })
  }
}
