export type TrackRatingChange = {
  albumId: string;
  trackPosition: number;
  rating: number;
};

const EVENT_NAME = 'track-rating-changed';

export function emitTrackRating(detail: TrackRatingChange) {
  window.dispatchEvent(new CustomEvent<TrackRatingChange>(EVENT_NAME, { detail }));
}

export function onTrackRating(handler: (detail: TrackRatingChange) => void) {
  const listener = (e: Event) => handler((e as CustomEvent<TrackRatingChange>).detail);
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
