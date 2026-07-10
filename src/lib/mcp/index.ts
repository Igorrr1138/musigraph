import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMyRatings from "./tools/list-my-ratings";
import rateAlbum from "./tools/rate-album";
import searchMusic from "./tools/search-music";
import getMyProfile from "./tools/get-my-profile";

// Direct Supabase issuer (never the .lovable.cloud proxy). Derived from the
// project ref that Vite inlines at build time so this stays import-safe.
const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "soundvault-mcp",
  title: "SoundVault",
  version: "0.1.0",
  instructions:
    "Tools for SoundVault, a music rating app. Use `search_music` to find artists/albums/tracks on Deezer, `rate_album` to record a 1-10 rating for the signed-in user, `list_my_ratings` to browse their rated albums, and `get_my_profile` for account info.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchMusic, listMyRatings, rateAlbum, getMyProfile],
});
