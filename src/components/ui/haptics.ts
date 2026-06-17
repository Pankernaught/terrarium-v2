/**
 * Semantic haptics (§3.6) — the best ROI on the premium list, but *only* mapped
 * to meaning, never decoration (a buzz with no meaning trains users to ignore
 * them, §6). Components call these named events, not `expo-haptics` directly, so
 * the mapping stays in one place. All are fire-and-forget and swallow the
 * "unsupported on this device" rejection.
 */
import * as Haptics from 'expo-haptics';

function safe(run: () => Promise<unknown>) {
  run().catch(() => {});
}

export const haptics = {
  /** Plant added / chip selected. */
  select: () => safe(() => Haptics.selectionAsync()),
  /** Snap to grid / drop accepted. */
  snap: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Step completed / sheet committed. */
  commit: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Survival-critical conflict created. */
  warn: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  /** Build saved. */
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Destructive action confirmed (delete). */
  destructive: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
};
