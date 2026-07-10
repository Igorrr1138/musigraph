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
  name: "rate_album",
  title: "Rate an album",
  description:
    "Create or update an album rating (1-10) for the signed-in user. Requires the Deezer album id, album title, and artist name.",
  inputSchema: {
    album_deezer_id: z
      .string()
      .min(1)
      .describe("Deezer album id (string)."),
    album_title: z.string().min(1),
    artist_name: z.string().min(1),
    rating: z.number().int().min(1).max(10),
    cover_url: z.string().url().optional(),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return {
        content: [{ type: "text", text: "Not authenticated." }],
        isError: true,
      };
    }
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("album_ratings")
      .upsert(
        {
          user_id: ctx.getUserId(),
          album_deezer_id: input.album_deezer_id,
          album_title: input.album_title,
          artist_name: input.artist_name,
          rating: input.rating,
          cover_url: input.cover_url ?? null,
          rated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,album_deezer_id" },
      )
      .select()
      .single();
    if (error) {
      return {
        content: [{ type: "text", text: error.message }],
        isError: true,
      };
    }
    return {
      content: [
        {
          type: "text",
          text: `Rated "${input.album_title}" by ${input.artist_name}: ${input.rating}/10`,
        },
      ],
      structuredContent: { rating: data },
    };
  },
});
