# PlannerPreview (sprite-plane) kept dormant for future 3D

The original `preview.tsx` is a top-down sprite-plane where plants and hardscape are dragged to normalized (x, y) positions. The cross-section replaces it as the live planner visualization, but `preview.tsx` is not deleted.

The `Placement` coordinate system (normalized x/y, scale multiplier) is the intended seed data for a future 3D view using `expo-gl` + Three.js. Keeping `preview.tsx` in the codebase preserves the gesture logic, sprite model, and `onCommit` wiring as a working reference for the 3D implementation. It is simply not rendered anywhere until that work begins.

A reader finding `preview.tsx` with no import site should not delete it — it is intentionally dormant.
