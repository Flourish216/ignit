import { streamText } from "ai"
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

  const result = streamText({
    model: "openai/gpt-4o-mini",
    system: `You are a project planning assistant. When given a project idea, you break it down into:
1. A clear, concise project title (max 60 characters)
2. A detailed project description (2-3 sentences)
3. Key milestones (3-5 milestones with estimated timeframes)
4. Required team roles (list specific skills needed)
5. Potential challenges and how to address them

Respond in JSON format with this structure:
{
  "title": "Project Title",
  "description": "Detailed description of the project",
  "milestones": [
    { "name": "Milestone name", "description": "What needs to be done", "timeframe": "1-2 weeks" }
  ],
  "roles": [
    { "title": "Role title", "skills": ["skill1", "skill2"], "description": "What this person will do" }
  ],
  "challenges": [
    { "challenge": "Description of challenge", "solution": "How to address it" }
  ]
}`,
    prompt: `Break down this project idea into actionable components: "${idea}"`,
  })

  return result.toDataStreamResponse()
}
