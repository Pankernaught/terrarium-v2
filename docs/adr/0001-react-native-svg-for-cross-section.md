# react-native-svg for the 2D cross-section renderer

The planner cross-section is a declarative, mostly-static 2D illustration — container outlines, layer fills, plant bars, SVG patterns for substrate texture. `react-native-svg` handles arbitrary paths (needed for non-rectangular container shapes like fishbowl), SVG pattern fills (needed for per-component substrate textures), and integrates with Expo's managed workflow via a single `expo install`. It is the natural fit.

`@shopify/react-native-skia` was considered but rejected: it is heavier, harder to configure in managed Expo, and its canvas/paint model is overkill for a scene with no per-frame shader work. Skia would be reconsidered if the cross-section needed real-time particle effects or complex blending.

The future 3D view will use a different engine entirely (`expo-gl` + Three.js). The two renderers are siblings consuming the same domain data — they share no rendering code.
