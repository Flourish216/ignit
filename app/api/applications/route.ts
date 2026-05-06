import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"

type ApplicationRequest = {
  projectId?: string
  message?: string | null
}

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")

const getProfile = async (supabase: Awaited<ReturnType<typeof createClient>>, userId: string) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("id", userId)
    .maybeSingle()

  if (error) throw error
  return data as { id: string; full_name: string | null } | null
}

const getAuthUserEmail = async (userId: string) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) return null

  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (error) {
    console.error("Could not fetch owner auth email:", error)
    return null
  }

  return data.user?.email || null
}

const sendInterestEmail = async ({
  to,
  ownerName,
  applicantName,
  projectTitle,
  message,
  projectUrl,
}: {
  to: string
  ownerName?: string | null
  applicantName: string
  projectTitle: string
  message?: string | null
  projectUrl: string
}) => {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM

  if (!apiKey || !from) {
    console.info("Skipping interest email: RESEND_API_KEY or EMAIL_FROM is not configured.")
    return
  }

  const safeOwnerName = ownerName || "there"
  const safeProjectTitle = escapeHtml(projectTitle)
  const safeApplicantName = escapeHtml(applicantName)
  const safeMessage = message?.trim() ? escapeHtml(message.trim()) : ""
  const safeProjectUrl = escapeHtml(projectUrl)

  const subject = `${applicantName} is interested in ${projectTitle}`
  const text = [
    `Hi ${safeOwnerName},`,
    "",
    `${applicantName} is interested in your Spark: ${projectTitle}.`,
    safeMessage ? `Message: ${message}` : "",
    "",
    `Review it here: ${projectUrl}`,
  ].filter(Boolean).join("\n")

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#171717">
      <p>Hi ${escapeHtml(safeOwnerName)},</p>
      <p><strong>${safeApplicantName}</strong> is interested in your Spark:</p>
      <p style="font-size:18px;font-weight:700">${safeProjectTitle}</p>
      ${safeMessage ? `<blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #6366f1;background:#f8fafc">${safeMessage}</blockquote>` : ""}
      <p>
        <a href="${safeProjectUrl}" style="display:inline-block;padding:10px 14px;border-radius:8px;background:#4f46e5;color:#fff;text-decoration:none">
          Review interest
        </a>
      </p>
      <p style="font-size:13px;color:#737373">Sent by Ignit.</p>
    </div>
  `

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text,
      html,
    }),
  })

  if (!response.ok) {
    console.error("Could not send interest email:", await response.text())
  }
}

export async function POST(request: Request) {
  const { projectId, message }: ApplicationRequest = await request.json()

  if (!projectId) {
    return new Response("Project is required", { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, title, owner_id")
    .eq("id", projectId)
    .single()

  if (projectError || !project) {
    return new Response("Spark not found", { status: 404 })
  }

  if (project.owner_id === user.id) {
    return new Response("Owners cannot respond to their own Spark", { status: 400 })
  }

  const { data: application, error: applicationError } = await supabase
    .from("project_applications")
    .insert({
      project_id: projectId,
      user_id: user.id,
      role_applied: "Interested",
      message: message?.trim() || null,
    })
    .select("*")
    .single()

  if (applicationError) {
    return Response.json({ error: applicationError.message }, { status: 400 })
  }

  try {
    const [ownerProfile, applicantProfile] = await Promise.all([
      getProfile(supabase, project.owner_id),
      getProfile(supabase, user.id),
    ])
    const ownerEmail = await getAuthUserEmail(project.owner_id)
    const applicantName = applicantProfile?.full_name || user.email?.split("@")[0] || "Someone"
    const siteUrl = process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || new URL(request.url).origin

    if (ownerEmail) {
      await sendInterestEmail({
        to: ownerEmail,
        ownerName: ownerProfile?.full_name,
        applicantName,
        projectTitle: project.title,
        message,
        projectUrl: `${siteUrl}/teams?view=applications`,
      })
    } else {
      console.info(`Skipping interest email: no email found for owner ${project.owner_id}.`)
    }
  } catch (error) {
    console.error("Interest email notification failed:", error)
  }

  return Response.json({ application })
}
