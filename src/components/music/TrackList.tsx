import { motion } from 'framer-motion';
import { Music, Clock } from 'lucide-react';
import { formatDuration } from '@/lib/musicbrainz';

interface Track {
  id: string;
  title: string;
  position: number;
  length?: number;
}

interface TrackListProps {
  tracks: Track[];
}

export function TrackList({ tracks }: TrackListProps) {
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[auto_1fr_auto] gap-4 px-4 py-2 text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
        <span>#</span>
        <span>Title</span>
        <Clock className="w-4 h-4" />
      </div>
      
      {tracks.map((track, index) => (
        <motion.div
          key={track.id || index}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: index * 0.03 }}
          className="grid grid-cols-[auto_1fr_auto] gap-4 px-4 py-3 rounded-lg hover:bg-secondary/50 transition-colors group"
        >
          <span className="text-muted-foreground group-hover:text-primary transition-colors font-mono text-sm w-8">
            {track.position}
          </span>
          
          <div className="flex items-center gap-3 min-w-0">
            <Music className="w-4 h-4 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="truncate group-hover:text-primary transition-colors">
              {track.title}
            </span>
          </div>
          
          <span className="text-muted-foreground text-sm font-mono">
            {track.length ? formatDuration(track.length) : '--:--'}
          </span>
        </motion.div>
      ))}
    </div>
  );
}
