import { useCallback, useEffect, useRef, useState } from 'react';

const KEY = 'rest-timer';

interface TimerState {
  endAt: number | null;
  total: number;
  label: string;
}

function load(): TimerState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { endAt: null, total: 0, label: '' };
}

function save(s: TimerState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

let audioCtx: AudioContext | null = null;
/** Нужно вызвать из обработчика нажатия: iOS разрешает звук только после жеста пользователя. */
export function unlockAudio() {
  try {
    audioCtx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
  } catch {
    /* ignore */
  }
}

export function beep() {
  try {
    unlockAudio();
    const ctx = audioCtx!;
    const t0 = ctx.currentTime;
    [0, 0.25, 0.5].forEach((dt, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = i === 2 ? 1320 : 880;
      g.gain.setValueAtTime(0.0001, t0 + dt);
      g.gain.exponentialRampToValueAtTime(0.4, t0 + dt + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(t0 + dt);
      o.stop(t0 + dt + 0.22);
    });
  } catch {
    /* ignore */
  }
}

/** Таймер отдыха по отметке времени окончания — переживает блокировку экрана и перезагрузку. */
export function useRestTimer(opts: { sound: boolean; vibration: boolean }) {
  const [state, setState] = useState<TimerState>(load);
  const [now, setNow] = useState(Date.now());
  const firedFor = useRef<number | null>(null);

  useEffect(() => {
    if (!state.endAt) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [state.endAt]);

  const remaining = state.endAt ? Math.max(0, Math.ceil((state.endAt - now) / 1000)) : 0;

  useEffect(() => {
    if (state.endAt && remaining === 0 && firedFor.current !== state.endAt) {
      firedFor.current = state.endAt;
      // не сигналим, если таймер истёк давно (например, вернулись в приложение через час)
      if (now - state.endAt < 5000) {
        if (opts.vibration && 'vibrate' in navigator) navigator.vibrate([400, 150, 400, 150, 400]);
        if (opts.sound) beep();
      }
      const next = { endAt: null, total: 0, label: '' };
      setState(next);
      save(next);
    }
  }, [remaining, state.endAt, now, opts.sound, opts.vibration]);

  const start = useCallback((seconds: number, label = '') => {
    unlockAudio();
    const next = { endAt: Date.now() + seconds * 1000, total: seconds, label };
    setNow(Date.now());
    setState(next);
    save(next);
  }, []);

  const add = useCallback((delta: number) => {
    setState((s) => {
      if (!s.endAt) return s;
      const next = { ...s, endAt: Math.max(Date.now(), s.endAt + delta * 1000), total: Math.max(1, s.total + delta) };
      save(next);
      return next;
    });
  }, []);

  const stop = useCallback(() => {
    const next = { endAt: null, total: 0, label: '' };
    setState(next);
    save(next);
  }, []);

  return { running: !!state.endAt, remaining, total: state.total, label: state.label, start, add, stop };
}

export function formatSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
