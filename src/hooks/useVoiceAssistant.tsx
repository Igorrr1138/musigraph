import { useState, useEffect, useRef, useCallback } from 'react';

type VoiceState = 'off' | 'passive' | 'active';

const WORD_TO_NUM: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
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

interface UseVoiceAssistantOptions {
  onRatingDetected: (rating: number) => void;
  onDuckVolume: (ducked: boolean) => void;
}

export function useVoiceAssistant({ onRatingDetected, onDuckVolume }: UseVoiceAssistantOptions) {
  const [enabled, setEnabled] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>('off');
  const recognitionRef = useRef<any>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const deactivate = useCallback(() => {
    setVoiceState('passive');
    onDuckVolume(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, [onDuckVolume]);

  const activate = useCallback(() => {
    setVoiceState('active');
    playBeep();
    onDuckVolume(true);
    // Auto-deactivate after 5 seconds
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      deactivate();
    }, 5000);
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
      console.warn('Web Speech API not supported');
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

      if (voiceStateRef.current === 'passive') {
        if (transcript.includes('wake up')) {
          activate();
        }
      } else if (voiceStateRef.current === 'active') {
        // Check for number
        const words = transcript.split(/\s+/);
        for (const word of words) {
          const num = WORD_TO_NUM[word];
          if (num) {
            onRatingDetected(num);
            playConfirmation();
            deactivate();
            return;
          }
        }
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      console.error('Speech recognition error:', event.error);
    };

    recognition.onend = () => {
      // Restart if still enabled
      if (enabledRef.current) {
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

  // Use refs to access latest state in callbacks
  const voiceStateRef = useRef(voiceState);
  voiceStateRef.current = voiceState;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const toggle = useCallback(() => setEnabled(prev => !prev), []);

  return { enabled, voiceState, toggle };
}
