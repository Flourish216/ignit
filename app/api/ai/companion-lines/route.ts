import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const { name, bio, current_goals, availability, location, sparks } = await request.json()

  const profileText = [bio, current_goals, sparks].filter(Boolean).join("\n")
  if (!profileText.trim()) {
    return new Response("Profile description is required", { status: 400 })
  }

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
    const isChinese = /[\u4e00-\u9fa5]/.test(profileText)
    const responseLanguage = isChinese ? "Simplified Chinese" : "English"

    const systemPrompt = `You write short floating speech lines for Igni, the user's pixel companion in Ignit.

Ignit helps people find someone to start something with. It is not a dating app, not LinkedIn, and not a generic social feed.

The user should not label themselves with tags. Read their paragraph and Sparks, then infer 6 short natural lines that Igni could say around the character.

Rules:
- Respond in ${responseLanguage}.
- Return ONLY valid JSON.
- JSON shape: { "lines": ["line 1", "line 2", "line 3", "line 4", "line 5", "line 6"] }
- Each line must be 2 to 7 words.
- Do not use corporate language.
- Do not use dating-app language.
- Do not say "like-minded", "tribe", "unlock", "empower", "revolutionary", or "AI-powered".
- Lines should feel specific, warm, and a little playful.
- Prefer describing what they want to start, how they move, and what kind of collaboration would fit.`

    const userPrompt = `Profile name: ${name || "Unnamed"}
Location: ${location || "Flexible"}
Availability: ${availability || "Flexible"}

About:
${bio || "Not provided"}

What they want to start:
${current_goals || "Not provided"}

Existing Sparks:
${sparks || "No Sparks yet"}`

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
          { role: "user", content: userPrompt },
        ],
        temperature: 0.5,
        max_tokens: 800,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("GLM companion error:", errorText)
      return new Response(`AI service error: ${response.status}`, { status: 502 })
    }

    const data = await response.json()
    const aiContent = data.choices?.[0]?.message?.content

    if (!aiContent) {
      return new Response("Invalid AI response", { status: 502 })
    }

    const jsonMatch = aiContent.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return new Response("Failed to parse AI response", { status: 502 })
    }

    const parsed = JSON.parse(jsonMatch[0])
    const lines = Array.isArray(parsed.lines)
      ? parsed.lines
          .filter((line: unknown) => typeof line === "string")
          .map((line: string) => line.trim())
          .filter(Boolean)
          .slice(0, 6)
      : []

    if (lines.length === 0) {
      return new Response("AI returned no lines", { status: 502 })
    }

    return Response.json({ lines })
  } catch (error) {
    console.error("Error generating companion lines:", error)
    return new Response("Failed to generate companion lines", { status: 500 })
  }
}
