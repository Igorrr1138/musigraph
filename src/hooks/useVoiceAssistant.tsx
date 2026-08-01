import { useState, useEffect, useRef, useCallback } from 'react';

type VoiceState = 'off' | 'passive' | 'active';

const WORD_TO_NUM: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  // Common misrecognitions
  won: 1, want: 1, wan: 1, juan: 1, an: 1, a: 1,
  to: 2, too: 2, tu: 2, tue: 2, do: 2, ii: 2,
  tree: 3, free: 3, thee: 3, trees: 3, three3: 3,
  for: 4, fore: 4, foure: 4, ford: 4, floor: 4, war: 4,
  faive: 5, fife: 5, hive: 5, five5: 5,
  sex: 6, sik: 6, sics: 6, sicks: 6, six6: 6,
  sevin: 7, sevan: 7, heaven: 7, seve: 7,
  ate: 8, eit: 8, hate: 8, aid: 8, eight8: 8,
  nain: 9, nyne: 9, nein: 9, line: 9, mine: 9, dine: 9,
  then: 10, tin: 10, tan: 10, hen: 10, tenn: 10, den: 10, tent: 10, tend: 10, tempt: 10,
  '1': 1, '2': 2, '3': 3, '4': 4, '5': 5,
  '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
};

// Words that may surround the number and should be ignored ("give it a seven", "rate 7")
const FILLER = new Set([
  'give', 'it', 'the', 'rate', 'rating', 'set', 'score', 'is', 'of', 'out', 'ten',
  'star', 'stars', 'point', 'points', 'please', 'uh', 'um', 'okay', 'ok', 'yeah',
]);

function extractRating(transcript: string): number | null {
  const cleaned = transcript.toLowerCase().replace(/[.,!?;:"'()\-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;

  // Direct digit anywhere (e.g. "7", "give it a 10")
  const digit = cleaned.match(/\b(10|[1-9])\b/);
  if (digit) return parseInt(digit[1], 10);

  const words = cleaned.split(/\s+/);
  // Scan from the end so the most recent spoken number wins
  for (let i = words.length - 1; i >= 0; i--) {
    const w = words[i];
    if (FILLER.has(w) && !(words.length === 1)) continue;
    const num = WORD_TO_NUM[w];
    if (num) return num;
  }
  return null;
}



function playBeep(freq: number = 880, duration: number = 150) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.value = 0.15;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
    osc.stop(ctx.currentTime + duration / 1000);
  } catch {}
}

function playConfirmation() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 660;
    gain.gain.value = 0.12;
    osc.start();
    setTimeout(() => { osc.frequency.value = 880; }, 100);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.stop(ctx.currentTime + 0.3);
  } catch {}
}

function playNegativeBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 220;
    osc.type = 'sawtooth';
    gain.gain.value = 0.12;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.stop(ctx.currentTime + 0.4);
  } catch {}
}

interface UseVoiceAssistantOptions {
  onRatingDetected: (rating: number) => void;
  onDuckVolume: (ducked: boolean) => void;
  hasActiveTrack: boolean;
}

export function useVoiceAssistant({ onRatingDetected, onDuckVolume, hasActiveTrack }: UseVoiceAssistantOptions) {
  const [enabled, setEnabled] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>('off');
  const recognitionRef = useRef<any>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasActiveTrackRef = useRef(hasActiveTrack);
  hasActiveTrackRef.current = hasActiveTrack;

  const onRatingDetectedRef = useRef(onRatingDetected);
  onRatingDetectedRef.current = onRatingDetected;

  const onDuckVolumeRef = useRef(onDuckVolume);
  onDuckVolumeRef.current = onDuckVolume;

  const deactivate = useCallback(() => {
    setVoiceState('passive');
    onDuckVolumeRef.current(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const activate = useCallback(() => {
    if (!hasActiveTrackRef.current) {
      console.log('[Voice] No track active, cannot activate');
      playNegativeBeep();
      return false;
    }
    console.log('[Voice] Activated — listening for rating');
    setVoiceState('active');
    playBeep();
    onDuckVolumeRef.current(true);
    // Auto-deactivate after 7 seconds
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      console.log('[Voice] Timeout — returning to passive');
      playNegativeBeep();
      deactivate();
    }, 7000);
    return true;
  }, [onDuckVolume, deactivate]);

  useEffect(() => {
    if (!enabled) {
      setVoiceState('off');
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[Voice] Web Speech API not supported');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 6;
    recognitionRef.current = recognition;

    setVoiceState('passive');

    recognition.onresult = (event: any) => {
      // Look at the last few results, and every alternative of each — the top
      // alternative often mangles single spoken digits.
      const start = Math.max(0, event.resultIndex);
      const alternatives: string[] = [];
      for (let i = start; i < event.results.length; i++) {
        const res = event.results[i];
        for (let a = 0; a < res.length; a++) {
          const t = String(res[a]?.transcript || '').toLowerCase().trim();
          if (t) alternatives.push(t);
        }
      }
      if (!alternatives.length) return;
      console.log('[Voice] Heard:', alternatives, '| State:', voiceStateRef.current);

      if (voiceStateRef.current === 'passive') {
        if (alternatives.some(t => /wake\s*up|wakeup|wake app|way cup/.test(t))) {
          activate();
        }
      } else if (voiceStateRef.current === 'active') {
        for (const t of alternatives) {
          const num = extractRating(t);
          if (num) {
            console.log('[Voice] Rating detected:', num, 'from:', t);
            onRatingDetectedRef.current(num);
            playConfirmation();
            deactivate();
            return;
          }
        }
      }
    };

    let permanentError = false;
    let restartTimer: ReturnType<typeof setTimeout> | null = null;

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        permanentError = true;
        console.warn('[Voice] Microphone permission denied');
        setEnabled(false);
        return;
      }
      console.error('[Voice] Error:', event.error);
    };

    recognition.onend = () => {
      if (enabledRef.current && !permanentError) {
        // Small delay avoids "already started" races in Chrome.
        restartTimer = setTimeout(() => {
          try { recognition.start(); } catch {}
        }, 150);
      }
    };


    try { recognition.start(); } catch {}

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [enabled]);

  // Refs for latest state in callbacks
  const voiceStateRef = useRef(voiceState);
  voiceStateRef.current = voiceState;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const toggle = useCallback(() => setEnabled(prev => !prev), []);

  // Programmatic activate for hotkey
  const manualActivate = useCallback(() => {
    if (!enabledRef.current) return false;
    return activate();
  }, [activate]);

  return { enabled, voiceState, toggle, manualActivate };
}
