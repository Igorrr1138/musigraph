import { Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useVoiceAssistant } from '@/hooks/useVoiceAssistant';
import { useYouTubePlayer } from '@/hooks/useYouTubePlayer';

interface VoiceAssistantProps {
  onRatingDetected: (rating: number) => void;
}

export function VoiceAssistant({ onRatingDetected }: VoiceAssistantProps) {
  const { setVolumeDucked } = useYouTubePlayer();
  const { enabled, voiceState, toggle } = useVoiceAssistant({
    onRatingDetected,
    onDuckVolume: setVolumeDucked,
  });

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
      
      {/* Status indicator */}
      {enabled && (
        <span className={cn(
          'text-xs px-2 py-0.5 rounded-full',
          voiceState === 'passive' && 'bg-secondary text-muted-foreground',
          voiceState === 'active' && 'bg-destructive/20 text-destructive',
        )}>
          {voiceState === 'passive' ? 'Waiting for "Wake up"' : 'Listening for rating'}
        </span>
      )}
    </div>
  );
}
