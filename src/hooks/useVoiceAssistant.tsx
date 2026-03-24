import { useState, useEffect, useRef, useCallback } from 'react';

type VoiceState = 'off' | 'passive' | 'active';

const WORD_TO_NUM: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  // Common misrecognitions for "ten"
  then: 10, tin: 10, tan: 10, hen: 10,
  '1': 1, '2': 2, '3': 3, '4': 4, '5': 5,
  '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
};

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
    onDuckVolume(true);
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
    recognitionRef.current = recognition;

    setVoiceState('passive');

    recognition.onresult = (event: any) => {
      const last = event.results[event.results.length - 1];
      const transcript = last[0].transcript.toLowerCase().trim();
      console.log('[Voice] Transcript:', transcript, '| State:', voiceStateRef.current);

      if (voiceStateRef.current === 'passive') {
        if (transcript.includes('wake up')) {
          activate();
        }
      } else if (voiceStateRef.current === 'active') {
        // Only process final results for rating
        if (!last.isFinal) return;
        const words = transcript.split(/\s+/);
        for (const word of words) {
          const num = WORD_TO_NUM[word];
          if (num) {
            console.log('[Voice] Rating detected:', num);
            onRatingDetected(num);
            playConfirmation();
            deactivate();
            return;
          }
        }
      }
    };

    let permanentError = false;

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
        try { recognition.start(); } catch {}
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
