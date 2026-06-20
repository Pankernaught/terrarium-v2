/**
 * Container domain type + zod schema (port of the Pydantic `Container` in
 * `engine/models/containers.py`). The pure geometry/opening snapshot the engine
 * reads — the DB layer uses a separate persisted model.
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
