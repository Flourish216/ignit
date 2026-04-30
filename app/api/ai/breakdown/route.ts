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
      ? `请帮我整理这个 Intent："${idea}"。\n\nIntent 指的是用户想找一个人一起做的事情，比如看演唱会、复习、健身、打游戏、逛城市、做 side project。\n\n请用 JSON 格式返回一张清楚、自然、不像约会软件也不像职场平台的 Intent Card。JSON 字段名必须保持英文，字段内容请使用简体中文。`
      : `Please structure this intent: "${idea}". An intent is something the user wants to do with someone else, such as going to a concert, studying, finding a gym partner, gaming, exploring a city, or building a side project. Keep the JSON field names exactly as requested and write all content values in English.`

    const systemPrompt = `You are an intent structuring assistant for Ignit, a product that helps people find someone to start something with.

Ignit is not a dating app, not LinkedIn, and not only for software projects.

Your goal is to turn a rough user intent into a simple Intent Card that another person can quickly understand and respond to.

CRITICAL: Respond in ${responseLanguage}. Keep all JSON field names in English exactly as specified, but write all user-facing content values in ${responseLanguage}.

Use a clean, student-friendly tone. Avoid corporate startup language. Avoid dating-app language.

When information is missing, infer a reasonable default rather than asking a follow-up.

Respond ONLY in valid JSON format with these exact keys:
{
  "title": "Short intent title, max 60 characters",
  "category": "One of: Social, Study, Fitness, Gaming, Explore, Creative, Side Project, Other",
  "description": "2 short sentences that explain what the user wants to do",
  "location": "Specific place if mentioned, otherwise Online, Campus, Local, or Flexible",
  "time_availability": "When this might happen, or Flexible",
  "looking_for": "Who would be a good buddy for this",
  "vibe": "Low-pressure description of the social energy",
  "commitment": "One-time, recurring, casual, or focused",
  "status": "open"
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
