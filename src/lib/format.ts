export const f2 = (n: number): string => (Math.round(n * 100) / 100).toFixed(2);

export const mmss = (s: number): string => {
  const m = Math.floor(s / 60);
  const x = s % 60;
  return `${m}:${x.toFixed(2).padStart(5, '0')}`;
};

export const hasCJK = (t: string): boolean =>
  /[\u3000-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(t);

export const isTagOnly = (words: string): boolean =>
  /^\[(other-noise|inhale|exhale|breath|laugh|chuckle|lip-smack|clear-throat|scoff|sniff|tsk|unintelligible)\]$/.test(
    words.trim(),
  );

export const flagged = (s: { start: number; end: number }): boolean => s.end - s.start < 0.2;

export const formatElapsed = (s: number): string => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};
