import { useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useVoiceAssistant } from '@/hooks/useVoiceAssistant';
import { useYouTubePlayer } from '@/hooks/useYouTubePlayer';
import { useToast } from '@/hooks/use-toast';

interface VoiceAssistantProps {
  onRatingDetected: (rating: number) => void;
}

export function VoiceAssistant({ onRatingDetected }: VoiceAssistantProps) {
  const { setVolumeDucked, currentTrack } = useYouTubePlayer();
  const { toast } = useToast();
  const hasActiveTrack = !!currentTrack;

  const { enabled, voiceState, toggle, manualActivate } = useVoiceAssistant({
    onRatingDetected,
    onDuckVolume: setVolumeDucked,
    hasActiveTrack,
  });

  // Space+W hotkey for manual activation
  useEffect(() => {
    const keys = new Set<string>();

    const onDown = (e: KeyboardEvent) => {
      // Don't trigger in input fields
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;

      keys.add(e.key.toLowerCase());

      if (keys.has(' ') && keys.has('w')) {
        e.preventDefault();
        const activated = manualActivate();
        if (!activated && enabled) {
          toast({
            title: 'Select a track first',
            description: 'Play a track before using voice rating.',
            variant: 'destructive',
          });
        }
      }
    };

    const onUp = (e: KeyboardEvent) => {
      keys.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [manualActivate, enabled, toast]);

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={toggle}
        className={cn(
          'gap-2 rounded-full transition-all',
          voiceState === 'active' && 'text-destructive animate-pulse',
          voiceState === 'passive' && 'text-primary',
          voiceState === 'off' && 'text-muted-foreground',
        )}
      >
        {enabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
        <span className="text-xs hidden sm:inline">
          {voiceState === 'off' && 'Voice Off'}
          {voiceState === 'passive' && 'Listening...'}
          {voiceState === 'active' && 'Say rating!'}
        </span>
      </Button>
      
      {enabled && (
        <span className={cn(
          'text-xs px-2 py-0.5 rounded-full',
          voiceState === 'passive' && 'bg-secondary text-muted-foreground',
          voiceState === 'active' && 'bg-destructive/20 text-destructive',
        )}>
          {voiceState === 'passive' ? 'Waiting for "Wake up" (Space+W)' : 'Listening for rating'}
        </span>
      )}
    </div>
  );
}
