/**
 * Motion helpers. Everything animates `transform` and `opacity` only (compositor-friendly), through
 * the Web Animations API. Springs are sampled into a CSS `linear()` easing, so a spring is just an
 * easing string plus a duration and runs off the main thread like any other animation.
 */

export type SpringName = 'snappy' | 'gentle' | 'bouncy' | 'soft';

const SPRINGS: Record<SpringName, { stiffness: number; damping: number; mass: number }> = {
  // UI chrome: card morphs, view swaps. Barely-there overshoot.
  snappy: { stiffness: 520, damping: 42, mass: 1 },
  // Larger surfaces: sheets, shared logo flights.
  gentle: { stiffness: 300, damping: 30, mass: 1 },
  // Small celebratory pops: success / error badges.
  bouncy: { stiffness: 480, damping: 22, mass: 1 },
  // Long, calm settles.
  soft: { stiffness: 200, damping: 26, mass: 1 },
};

const FALLBACK = 'cubic-bezier(0.22, 1, 0.36, 1)';

export interface SpringCurve {
  easing: string;
  duration: number;
  /** cubic-bezier stand-in for engines without `linear()` */
  fallback: string;
}

/** Sample a damped spring from 0 to 1 into `linear()` stops. Pure; safe on the server. */
export function sampleSpring(stiffness: number, damping: number, mass = 1): SpringCurve {
  const dt = 1 / 1000;
  let x = 0;
  let v = 0;
  const xs: number[] = [0];
  for (let i = 0; i < 3000; i++) {
    const a = (-stiffness * (x - 1) - damping * v) / mass;
    v += a * dt;
    x += v * dt;
    xs.push(x);
    if (Math.abs(x - 1) < 0.0008 && Math.abs(v) < 0.01) break;
  }
  const duration = xs.length - 1;
  const steps = Math.min(40, duration);
  const stops: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const v2 = i === steps ? 1 : xs[Math.round((i / steps) * duration)];
    stops.push(String(Math.round(v2 * 10000) / 10000));
  }
  return { easing: `linear(${stops.join(', ')})`, duration, fallback: FALLBACK };
}

const cache: Partial<Record<SpringName, SpringCurve>> = {};
export function spring(name: SpringName): SpringCurve {
  const hit = cache[name];
  if (hit) return hit;
  const s = SPRINGS[name];
  return (cache[name] = sampleSpring(s.stiffness, s.damping, s.mass));
}

let linearSupport: boolean | null = null;
function supportsLinear(): boolean {
  if (linearSupport === null) {
    try {
      linearSupport =
        typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('animation-timing-function', 'linear(0, 1)');
    } catch {
      linearSupport = false;
    }
  }
  return linearSupport;
}

export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export interface AnimateOptions {
  spring?: SpringName;
  duration?: number;
  easing?: string;
  delay?: number;
  fill?: FillMode;
  /** Keep running under reduced motion (opacity-only fades are kept anyway). */
  essential?: boolean;
}

/**
 * Run a WAAPI animation. Under `prefers-reduced-motion`, transform keyframes are dropped and what is
 * left (opacity) runs as a short fade; a transform-only animation is skipped.
 */
export function animate(el: Element | null | undefined, keyframes: Keyframe[], opts: AnimateOptions = {}): Animation | null {
  if (!el || typeof (el as HTMLElement).animate !== 'function') return null;
  let frames = keyframes;
  let duration = opts.duration;
  let easing = opts.easing;
  if (opts.spring) {
    const s = spring(opts.spring);
    duration = duration ?? s.duration;
    easing = easing ?? (supportsLinear() ? s.easing : s.fallback);
  }
  if (prefersReducedMotion() && !opts.essential) {
    const hasOpacity = frames.some((f) => f.opacity !== undefined);
    if (!hasOpacity) return null;
    frames = frames.map((f) => ({ opacity: f.opacity }));
    duration = Math.min(duration ?? 160, 160);
    easing = 'linear';
  }
  try {
    return (el as HTMLElement).animate(frames, {
      duration: duration ?? 240,
      easing: easing ?? FALLBACK,
      delay: opts.delay ?? 0,
      fill: opts.fill ?? 'both',
    });
  } catch {
    return null;
  }
}

/** Resolve when an animation finishes or is cancelled (never rejects). */
export function settled(a: Animation | null): Promise<void> {
  if (!a) return Promise.resolve();
  return a.finished.then(
    () => undefined,
    () => undefined
  );
}

/** Cancel every running WAAPI animation on the given elements. */
export function cancelAnimations(...els: (Element | null | undefined)[]): void {
  for (const el of els) {
    if (!el || typeof (el as HTMLElement).getAnimations !== 'function') continue;
    for (const a of (el as HTMLElement).getAnimations()) a.cancel();
  }
}

/** CSS custom-property block that exposes the springs to stylesheet animations. */
export function springCssVars(): string {
  const s = spring('snappy');
  const b = spring('bouncy');
  return `--mw-spring:${s.easing};--mw-spring-ms:${s.duration}ms;--mw-bounce:${b.easing};--mw-bounce-ms:${b.duration}ms;`;
}
