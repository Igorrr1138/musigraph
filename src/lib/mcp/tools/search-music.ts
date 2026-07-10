import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

type DeezerSearchResult = {
  data?: Array<{
    id: number;
    title?: string;
    name?: string;
    artist?: { id: number; name: string };
    album?: { id: number; title: string; cover_medium?: string };
    picture_medium?: string;
    cover_medium?: string;
  }>;
  error?: { message?: string };
};

export default defineTool({
  name: "search_music",
  title: "Search music",
  description:
    "Search for artists, albums, or tracks on Deezer (the catalog SoundVault uses).",
  inputSchema: {
    query: z.string().min(1).describe("Search text."),
    type: z
      .enum(["artist", "album", "track"])
      .default("album")
      .describe("What to search for."),
    limit: z.number().int().min(1).max(25).default(10),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ query, type, limit }) => {
    const url = `https://api.deezer.com/search/${type}?q=${encodeURIComponent(query)}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) {
      return {
        content: [{ type: "text", text: `Deezer error: ${res.status}` }],
        isError: true,
      };
    }
    const json = (await res.json()) as DeezerSearchResult;
    if (json.error) {
      return {
        content: [{ type: "text", text: json.error.message ?? "Deezer error" }],
        isError: true,
      };
    }
    const results = (json.data ?? []).map((item) => ({
      id: String(item.id),
      title: item.title ?? item.name,
      artist: item.artist?.name,
      album: item.album?.title,
      cover: item.album?.cover_medium ?? item.cover_medium ?? item.picture_medium,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(results) }],
      structuredContent: { results },
    };
  },
});
