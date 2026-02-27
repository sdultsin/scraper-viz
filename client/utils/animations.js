// animations.js - Easing and animation utilities

export const easings = {
  linear: t => t,
  easeInQuad: t => t * t,
  easeOutQuad: t => t * (2 - t),
  easeInOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeInCubic: t => t * t * t,
  easeOutCubic: t => (--t) * t * t + 1,
  easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  easeOutElastic: t => {
    const p = 0.3;
    return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
  },
  easeOutBounce: t => {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
  },
};

export function animate(from, to, duration, easing, onUpdate, onComplete) {
  const start = performance.now();
  const easingFn = typeof easing === 'string' ? easings[easing] : easing;

  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easingFn(progress);
    const value = from + (to - from) * easedProgress;

    onUpdate(value);

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else if (onComplete) {
      onComplete();
    }
  }

  requestAnimationFrame(tick);
}

export function animateObject(obj, props, duration, easing = 'easeOutCubic') {
  const startValues = {};
  for (const key of Object.keys(props)) {
    startValues[key] = obj[key];
  }

  return new Promise(resolve => {
    animate(0, 1, duration, easing, progress => {
      for (const key of Object.keys(props)) {
        obj[key] = startValues[key] + (props[key] - startValues[key]) * progress;
      }
    }, resolve);
  });
}

export function createPulse(element, scale = 1.05, duration = 200) {
  element.style.transition = `transform ${duration}ms ease`;
  element.style.transform = `scale(${scale})`;
  setTimeout(() => {
    element.style.transform = 'scale(1)';
  }, duration);
}

export function createShake(element, intensity = 5, duration = 300) {
  const keyframes = [
    { transform: 'translateX(0)' },
    { transform: `translateX(-${intensity}px)` },
    { transform: `translateX(${intensity}px)` },
    { transform: `translateX(-${intensity}px)` },
    { transform: `translateX(${intensity}px)` },
    { transform: 'translateX(0)' },
  ];

  element.animate(keyframes, { duration, easing: 'ease-in-out' });
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default { easings, animate, animateObject, createPulse, createShake, lerp, clamp };
