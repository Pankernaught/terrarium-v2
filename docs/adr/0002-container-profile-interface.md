# ContainerProfile interface as the cross-section extensibility seam

The cross-section renderer needs to draw different container outlines (rectangular, cylindrical, and eventually fishbowl and others). A simple `switch` on `ContainerShape` would work for two shapes but would require touching the renderer every time a new shape is added.

Instead, each shape is encoded as a `ContainerShapeProfile` object (in `src/components/planner/container-profiles.ts`) implementing a small contract: `wallPath(geom)` returns the open SVG silhouette stroked as the walls, `interiorClipPath(geom)` returns the closed silhouette used to clip every interior fill (so a rounded base or narrowing neck clips layers for free), and `interiorWidthAt(geom, yFrac)` returns how wide the interior is at any height. New shapes (fishbowl, hex tank, etc.) are drop-in implementations registered in `CONTAINER_PROFILES` — the renderer never changes.

(Named `ContainerShapeProfile`, not `ContainerProfile`: the latter already exists in `src/logic/containers.ts` for the *vertical* layer-band math — drainage/charcoal/substrate boundaries in cm. The two are complementary — vertical cm bands vs. horizontal shape geometry — and the cross-section composes both.)

The alternative — a shape-switch inside the renderer — was rejected because hardscape shape variety is a planned premium feature and the container shape vocabulary is expected to grow. The interface makes each new shape a self-contained addition.
