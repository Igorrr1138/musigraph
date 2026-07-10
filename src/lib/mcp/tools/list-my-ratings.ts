import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

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
  name: "list_my_ratings",
  title: "List my album ratings",
  description:
    "List the signed-in user's album ratings from SoundVault, most recent first.",
  inputSchema: {
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .describe("Max ratings to return (1-100)."),
    min_rating: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .describe("Optional minimum rating filter (1-10)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, min_rating }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return {
        content: [{ type: "text", text: "Not authenticated." }],
        isError: true,
      };
    }
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("album_ratings")
      .select(
        "album_title, artist_name, rating, rated_at, album_deezer_id, cover_url",
      )
      .eq("user_id", ctx.getUserId())
      .order("rated_at", { ascending: false })
      .limit(limit);
    if (min_rating !== undefined) q = q.gte("rating", min_rating);
    const { data, error } = await q;
    if (error) {
      return {
        content: [{ type: "text", text: error.message }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { ratings: data ?? [] },
    };
  },
});
