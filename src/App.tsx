import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { YouTubePlayerProvider } from "@/hooks/useYouTubePlayer";
import { PlaybackBar } from "@/components/player/PlaybackBar";
import Index from "./pages/Index";
import SearchPage from "./pages/SearchPage";
import OnboardingPage from "./pages/OnboardingPage";
import PricingPage from "./pages/PricingPage";
import AuthPage from "./pages/AuthPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import ArtistPage from "./pages/ArtistPage";
import AlbumPage from "./pages/AlbumPage";
import DashboardPage from "./pages/DashboardPage";
import DiscographyMapPage from "./pages/DiscographyMapPage";
import ArtistRatingsPage from "./pages/ArtistRatingsPage";
import GenrePage from "./pages/GenrePage";
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
              <Route path="/search" element={<SearchPage />} />
              <Route path="/onboarding" element={<OnboardingPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/artist/:id" element={<ArtistPage />} />
              <Route path="/album/:id" element={<AlbumPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/dashboard/:tab" element={<DashboardPage />} />
              <Route path="/dashboard/:tab/:artistName" element={<DashboardPage />} />
              <Route path="/ratings" element={<Navigate to="/dashboard/rated-music" replace />} />
              <Route path="/ratings/artist/:artistName" element={<ArtistRatingsPage />} />
              <Route path="/graph" element={<Navigate to="/dashboard" replace />} />
              <Route path="/discography-map" element={<DiscographyMapPage />} />
              <Route path="/genre" element={<GenrePage />} />
              <Route path="/genre/:slug" element={<GenrePage />} />
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
