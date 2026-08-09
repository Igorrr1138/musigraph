import { useState } from 'react';
import { Star } from '@/components/icons';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface RatingStarsProps {
  rating: number;
  onRate?: (rating: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function RatingStars({ rating, onRate, readonly = false, size = 'md' }: RatingStarsProps) {
  const [hoverRating, setHoverRating] = useState(0);

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const getStarState = (index: number) => {
    const activeRating = hoverRating || rating;
    if (index <= activeRating) return 'full';
    if (index - 0.5 <= activeRating) return 'half';
    return 'empty';
  };

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((index) => {
        const state = getStarState(index);
        
        return (
          <motion.button
            key={index}
            type="button"
            disabled={readonly}
            onClick={() => onRate?.(index)}
            onMouseEnter={() => !readonly && setHoverRating(index)}
            onMouseLeave={() => !readonly && setHoverRating(0)}
            whileHover={readonly ? {} : { scale: 1.2 }}
            whileTap={readonly ? {} : { scale: 0.9 }}
            className={cn(
              'rating-star',
              readonly && 'cursor-default'
            )}
          >
            <Star
              className={cn(
                sizeClasses[size],
                'transition-colors duration-200',
                state === 'full' && 'fill-primary text-primary',
                state === 'half' && 'fill-primary/50 text-primary',
                state === 'empty' && 'fill-transparent text-muted-foreground'
              )}
            />
          </motion.button>
        );
      })}
      <span className="ml-2 text-lg font-bold text-primary font-mono">
        {rating || hoverRating || 0}/10
      </span>
    </div>
  );
}
