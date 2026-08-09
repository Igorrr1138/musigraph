import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Disc3 } from '@/components/icons';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { FavoriteGenresPicker } from '@/components/onboarding/FavoriteGenresPicker';
import { useSeoMeta } from '@/lib/seo';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, refetch } = useProfile();
  const { toast } = useToast();

  useSeoMeta({
    title: 'Set up your favorite genres — Discover & Rate',
    description: 'Pick your favorite music genres to personalize your Discover & Rate feed.',
  });

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth', { replace: true });
  }, [authLoading, user, navigate]);

  // If already onboarded, don't re-show
  useEffect(() => {
    if (!profileLoading && profile?.onboarding_completed) {
      navigate('/', { replace: true });
    }
  }, [profileLoading, profile, navigate]);

  const persist = async (genres: string[], completed: boolean) => {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update({ favorite_genres: genres, onboarding_completed: completed })
      .eq('user_id', user.id);
    if (error) {
      toast({
        title: 'Could not save preferences',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
    await refetch();
  };

  const handleSave = async (genres: string[]) => {
    await persist(genres, true);
    toast({ title: 'Preferences saved', description: 'Welcome aboard!' });
    navigate('/', { replace: true });
  };

  const handleSkip = async () => {
    await persist([], true);
    navigate('/', { replace: true });
  };

  if (authLoading || profileLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Disc3 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="pt-10 pb-6 flex items-center justify-center">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-2xl font-boldonse gradient-text">Discover &amp; Rate</span>
        </Link>
      </header>
      <main className="container mx-auto max-w-6xl px-4 pt-6">
        <FavoriteGenresPicker
          initial={profile?.favorite_genres ?? []}
          onSave={handleSave}
          onSkip={handleSkip}
          saveLabel="Save and proceed"
          floatingActions
        />
      </main>
    </div>
  );
}
