import { createClient } from "@/lib/supabase/server"

type SparkBreakdown = {
  title?: string
  category?: string
  description?: string
  location?: string
  time_availability?: string
  looking_for?: string
  vibe?: string
  commitment?: string
  status?: string
}

type WorkspaceMode = "ask" | "plan" | "brainstorm" | "research" | "recap"

const igniReplyPrefix = "__igni_reply__\n"

const modeInstruction: Record<WorkspaceMode, string> = {
  ask: "Answer the team's actual question directly. Be useful in the current conversation without forcing a plan or checklist unless they ask for one.",
  plan: "Turn the workspace context into a concrete plan with the next few steps. Prefer specific actions over strategy.",
  brainstorm: "Generate useful ideas, options, and tradeoffs for the team. Keep the ideas grounded in the Spark.",
  research: "Help the team figure out what to look up, compare, or validate. If facts are not in the context, clearly mark them as things to verify.",
  recap: "Summarize what has happened and identify decisions, open questions, and next actions.",
}

const normalizeMode = (mode: unknown): WorkspaceMode =>
  mode === "plan" || mode === "brainstorm" || mode === "research" || mode === "recap" ? mode : "ask"

export async function POST(request: Request) {
  const { teamId, question, mode } = await request.json()

  if (!teamId || !question?.trim()) {
    return new Response("Workspace and question are required", { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response("Unauthorized", { status: 401 })
  }

  const apiKey = process.env.GLM_API_KEY
  if (!apiKey) {
    return new Response("GLM API key not configured", { status: 500 })
  }

  try {
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select(`
        id,
        name,
        project_id,
        project:projects(id, title, description, status, owner_id, ai_breakdown)
      `)
      .eq("id", teamId)
      .single()

    if (teamError || !team) {
      return new Response("Workspace not found", { status: 404 })
    }

    const project = Array.isArray(team.project) ? team.project[0] : team.project
    const isOwner = project?.owner_id === user.id

    let isMember = false
    if (!isOwner) {
      const { data: membership } = await supabase
        .from("team_members")
        .select("id")
        .eq("team_id", teamId)
        .eq("user_id", user.id)
        .eq("status", "accepted")
        .maybeSingle()

      isMember = Boolean(membership)
    }

    if (!isOwner && !isMember) {
      return new Response("Forbidden", { status: 403 })
    }

    const { data: members } = await supabase
      .from("team_members")
      .select(`
        role,
        user:profiles(full_name)
      `)
      .eq("team_id", teamId)
      .eq("status", "accepted")
      .limit(12)

    const { data: recentMessages } = await supabase
      .from("messages")
      .select(`
        content,
        created_at,
        user_id
      `)
      .eq("project_id", team.project_id)
      .order("created_at", { ascending: false })
      .limit(30)

    const messageUserIds = Array.from(
      new Set((recentMessages || []).map((message: any) => message.user_id).filter(Boolean)),
    )
    const { data: messageProfiles } = messageUserIds.length
      ? await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", messageUserIds)
      : { data: [] }
    const messageProfilesById = new Map(
      (messageProfiles || []).map((profile: any) => [profile.id, profile.full_name]),
    )

    const details = (project?.ai_breakdown || {}) as SparkBreakdown
    const selectedMode = normalizeMode(mode)
    const promptText = question.trim().slice(0, 1600)
    const recentChat = (recentMessages || [])
      .slice()
      .reverse()
      .map((message: any) => {
        const name = messageProfilesById.get(message.user_id)
        const isIgniReply = typeof message.content === "string" && message.content.startsWith(igniReplyPrefix)
        const content = isIgniReply ? message.content.slice(igniReplyPrefix.length).trim() : message.content
        return `${isIgniReply ? "Igni" : name || "Someone"}: ${content}`
      })
      .join("\n")

    const memberText = (members || [])
      .map((member: any) => {
        const profile = Array.isArray(member.user) ? member.user[0] : member.user
        return `${profile?.full_name || "Someone"}${member.role ? ` (${member.role})` : ""}`
      })
      .join(", ")

    const isChinese = /[\u4e00-\u9fa5]/.test(
      [promptText, project?.title, project?.description, details.description].filter(Boolean).join("\n"),
    )
    const responseLanguage = isChinese ? "Simplified Chinese" : "English"

    const systemPrompt = `You are Igni, the workspace assistant inside Ignit.

Ignit helps people find someone to start something with. You help a matched team actually start.

You are not a generic chatbot and not a startup coach. Be practical, concise, warm, and specific.

Mode: ${selectedMode}
Mode goal: ${modeInstruction[selectedMode]}

Rules:
- Respond in ${responseLanguage}.
- Use the Spark and recent workspace context below.
- Answer what the team asked. Do not turn every reply into future steps.
- Do not invent facts. For anything that needs outside verification, label it as "verify".
- Prefer short sections and checklists.
- Keep the answer useful for people who are about to take action together.
- Avoid corporate words like empower, seamless, revolutionary, tribe, unlock, next-generation.`

    const userPrompt = `Spark:
Title: ${details.title || project?.title || team.name || "Untitled Spark"}
Category: ${details.category || "Not set"}
Description: ${details.description || project?.description || "Not set"}
Location: ${details.location || "Flexible"}
Time: ${details.time_availability || "Flexible"}
Looking for: ${details.looking_for || "Someone interested"}
Vibe: ${details.vibe || "Low-pressure"}
Commitment: ${details.commitment || "Flexible"}
Status: ${details.status || project?.status || "open"}

Workspace people:
${memberText || "No accepted members listed yet."}

Recent chat:
${recentChat || "No recent chat yet."}

Team asks Igni:
${promptText}`

    const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "glm-4-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: selectedMode === "brainstorm" ? 0.55 : 0.35,
        max_tokens: 1400,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("GLM workspace error:", errorText)
      return new Response(`AI service error: ${response.status}`, { status: 502 })
    }

    const data = await response.json()
    const answer = data.choices?.[0]?.message?.content?.trim()

    if (!answer) {
      return new Response("Invalid AI response", { status: 502 })
    }

    return Response.json({ answer, mode: selectedMode })
  } catch (error) {
    console.error("Error generating workspace answer:", error)
    return new Response("Failed to ask Igni", { status: 500 })
  }
}
