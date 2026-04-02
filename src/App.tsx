import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { YouTubePlayerProvider } from "@/hooks/useYouTubePlayer";
import { PlaybackBar } from "@/components/player/PlaybackBar";
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import ArtistPage from "./pages/ArtistPage";
import AlbumPage from "./pages/AlbumPage";
import RatingsPage from "./pages/RatingsPage";
import GraphPage from "./pages/GraphPage";
import DiscographyMapPage from "./pages/DiscographyMapPage";
import ArtistRatingsPage from "./pages/ArtistRatingsPage";
import NotFound from "./pages/NotFound";

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
