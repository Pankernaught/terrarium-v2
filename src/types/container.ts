/**
 * Container domain type + zod schema (port of the Pydantic `Container` in
 * `engine/models/containers.py`). This is the pure geometry/opening snapshot the
 * engine reads — the SQLAlchemy `ContainerModel` is DB-layer and lands in Phase 4.
 */
import { z } from 'zod';

export const CONTAINER_OPENINGS = ['sealed', 'lidded', 'open'] as const;
export const CONTAINER_SHAPES = ['rectangular', 'cylindrical'] as const;
export const CONTAINER_SUITABILITIES = ['closed', 'open', 'both'] as const;

export type ContainerOpening = (typeof CONTAINER_OPENINGS)[number];
export type ContainerShape = (typeof CONTAINER_SHAPES)[number];

export const containerSchema = z.object({
  slug: z.string(),
  name: z.string(),
  volumeL: z.number(),
  opening: z.enum(CONTAINER_OPENINGS),
  dimensionsCm: z.string(),
  shape: z.enum(CONTAINER_SHAPES).default('rectangular'),
  suitableFor: z.enum(CONTAINER_SUITABILITIES),
});

export type Container = z.infer<typeof containerSchema>;
