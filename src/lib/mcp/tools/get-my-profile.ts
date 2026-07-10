import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

function supabaseForUser(ctx: ToolContext) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export default defineTool({
  name: "get_my_profile",
  title: "Get my profile",
  description:
    "Return the signed-in user's SoundVault profile with a summary of how many albums they have rated.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return {
        content: [{ type: "text", text: "Not authenticated." }],
        isError: true,
      };
    }
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId();
    const [{ data: profile }, { count }] = await Promise.all([
      sb.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      sb
        .from("album_ratings")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId),
    ]);
    const summary = {
      email: ctx.getUserEmail(),
      username: (profile as { username?: string } | null)?.username ?? null,
      total_album_ratings: count ?? 0,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(summary) }],
      structuredContent: summary,
    };
  },
});
