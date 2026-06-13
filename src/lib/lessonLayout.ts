const storageKey = "streamline-lesson-divider-pct";

/**
 * Load the saved image panel width percentage (0-100).
 * Defaults to ~45% (image gets 45%, lyrics gets 55%).
 */
export function loadDividerPct(): number {
  if (typeof window === "undefined") {
    return 45;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);

    if (!raw) {
      return 45;
    }

    const value = Number(raw);

    if (Number.isFinite(value) && value >= 20 && value <= 80) {
      return value;
    }

    return 45;
  } catch {
    return 45;
  }
}

/**
 * Persist the image panel width percentage.
 */
export function saveDividerPct(pct: number) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, String(Math.round(pct)));
  } catch {
    // Silently fail
  }
}