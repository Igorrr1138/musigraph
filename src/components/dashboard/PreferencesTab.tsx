import { Disc3 } from '@/components/icons';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { FavoriteGenresPicker } from '@/components/onboarding/FavoriteGenresPicker';

export function PreferencesTab() {
  const { user } = useAuth();
  const { profile, loading, refetch } = useProfile();
  const { toast } = useToast();

  const handleSave = async (genres: string[]) => {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update({ favorite_genres: genres })
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
    toast({ title: 'Preferences updated' });
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card/40 p-16 flex justify-center backdrop-blur-sm">
        <Disc3 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/40 bg-card/40 p-6 md:p-10 backdrop-blur-sm">
      <FavoriteGenresPicker
        initial={profile?.favorite_genres ?? []}
        onSave={handleSave}
        saveLabel="Save changes"
      />
    </div>
  );
}
