import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { PlaybackBar } from "@/components/player/PlaybackBar";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { YouTubePlayerProvider } from "@/hooks/useYouTubePlayer";
import AccountSettingsPage from "./pages/AccountSettingsPage";
import AlbumPage from "./pages/AlbumPage";
import ArtistPage from "./pages/ArtistPage";
import ArtistRatingsPage from "./pages/ArtistRatingsPage";
import AuthPage from "./pages/AuthPage";
import DiscographyMapPage from "./pages/DiscographyMapPage";
import GraphPage from "./pages/GraphPage";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import PlaylistDetailPage from "./pages/PlaylistDetailPage";
import PlaylistsPage from "./pages/PlaylistsPage";
import RatingsPage from "./pages/RatingsPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <YouTubePlayerProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/artist/:id" element={<ArtistPage />} />
              <Route path="/album/:id" element={<AlbumPage />} />
              <Route path="/ratings" element={<RatingsPage />} />
              <Route path="/ratings/artist/:artistName" element={<ArtistRatingsPage />} />
              <Route path="/graph" element={<GraphPage />} />
              <Route path="/discography-map" element={<DiscographyMapPage />} />
              <Route path="/playlists" element={<PlaylistsPage />} />
              <Route path="/playlists/:playlistId" element={<PlaylistDetailPage />} />
              <Route path="/settings/account" element={<AccountSettingsPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <PlaybackBar />
          </BrowserRouter>
        </TooltipProvider>
      </YouTubePlayerProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
