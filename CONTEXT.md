# Terrarium V2

A mobile app for planning, building, and caring for terrariums. The planner guides users through configuring a container, substrate layers, plants, and hardscape into a saved Build.

## Language

### Planning

**Build**:
A saved terrarium configuration: a named container, its layer stack, selected plants, hardscape placements, and substrate mix.
_Avoid_: Project, setup, design

**Draft**:
The in-progress, unsaved Build being configured in the Planner. Converted to a Build on save.
_Avoid_: Config, form state

**Planner**:
The multi-step flow in which the user assembles a Draft step-by-step (container → substrate → hardscape → plants → review).
_Avoid_: Builder, wizard, editor

**Placement**:
A single positioned item (plant or hardscape) within a terrarium, carrying a normalized x-position, y-position, and scale multiplier. X and y are in [0, 1]; scale is clamped to [0.4, 1.4].
_Avoid_: Position, sprite, item

### Container

**Container**:
The physical vessel that holds the terrarium. Defined by its shape, opening type, and dimensions.

**Container Shape**:
The geometry of the container body: `rectangular` (flat walls, flat floor) or `cylindrical` (curved base). Determines how the cross-section outline is drawn.
_Avoid_: Type, form, vessel type

**Container Opening**:
How the container is accessed and sealed: `open` (no top), `lidded` (removable lid), or `sealed` (fully enclosed). Affects humidity, ventilation, and how the cross-section top edge is rendered.
_Avoid_: Lid type, enclosure

**Container Profile**:
The shape-specific contract that generates cross-section SVG geometry for a given Container Shape. Encodes how to draw the outline and how interior width varies with height. The extensibility seam for adding new shapes (e.g. fishbowl).

### Layer Stack

**Layer Stack**:
The ordered sequence of physical layers inside the container, from floor to surface: Drainage Layer → Charcoal Layer → Substrate Layer → air space.

**Drainage Layer**:
The bottom layer of coarse material (gravel, leca) that prevents waterlogging. Depth is set in cm.

**Charcoal Layer**:
A thin filtration layer of horticultural charcoal between the Drainage Layer and the Substrate Layer. Keeps anaerobic conditions from developing. Configured as on/off with a fixed default depth (~1.5 cm). Not a Substrate Component — it is a distinct physical layer.
_Avoid_: Charcoal mix, charcoal substrate

**Substrate Layer**:
The growing medium above the Charcoal Layer in which plants root. Depth is set in cm. Optionally enriched with a Substrate Mix.
_Avoid_: Soil layer, growing medium (acceptable in UI copy, but avoid in code)

**Substrate Mix**:
A user-defined blend of Substrate Components with relative proportions (parts, 1–9). Enriches the Substrate Layer visually and informationally. Null when the user has not defined a custom mix.
_Avoid_: Soil mix, substrate recipe

**Substrate Component**:
A canonical soil material from the frozen vocabulary (perlite, peat, sphagnum, potting soil, worm castings, etc.). Referenced by stable id. Charcoal is not a Substrate Component.
_Avoid_: Soil ingredient, material

**Leaf Litter**:
A surface covering placed on top of the Substrate Layer in bioactive builds. A care item requiring periodic replacement — not a Substrate Component and not part of the Layer Stack. Belongs in the care tab.
_Avoid_: Substrate topping, litter layer

### Cross-Section

**Cross-Section**:
The 2D SVG side-view rendering of the terrarium in the Planner. Shows the container outline, Layer Stack depths, plant height bars, root depth bands, and hardscape items at true scale.
_Avoid_: Preview (reserved for the dormant top-down view), viewer

**Root Depth Band**:
The semi-transparent rectangle rendered below the substrate surface for each plant, spanning from the surface to `rootDepthMaxCm`. Represents the range into which roots may grow.

### People

**Curator**:
The person who manages the Plant Catalog — the developer/app owner. Responsible for adding, editing, and removing plants before each release. Distinct from the end user who assembles terrariums.
_Avoid_: Admin, editor, user (reserved for the person building terrariums)

**Plant Catalog**:
The canonical set of plants available in the app. Reference data authored by the Curator — not user-generated. The Catalog is bundled with the app and seeded into the database at startup.
_Avoid_: Plant database, plant list

### Plants & Ecology

**Eco-Balance**:
A compatibility score for the plant selection in a Draft, measuring how well the selected plants' humidity, light, and moisture needs align with each other and with the container opening.
_Avoid_: Fit score (that's per-plant), compatibility

**Fit Score**:
A per-plant score measuring how well a single plant suits the current Draft's container and co-selected plants. Distinct from Eco-Balance (which is a whole-build score).
_Avoid_: Compatibility score
