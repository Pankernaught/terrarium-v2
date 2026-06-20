/**
 * The app-edge database wiring. This is the *one* place the native driver is
 * constructed: `createExpoDb()` opens the device SQLite file, `seedStore`
 * idempotently loads the plants/containers/presets on first launch, and the
 * repositories are built once and handed down by context. Screens call `useRepos()`
 * — they never import a concrete driver or re-implement persistence.
 *
 * Native-only: imports `client.expo`, so it must never be pulled into the node
 * Vitest runner (the repos are unit-tested there against `client.node` instead).
 */
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';

import { createExpoDb } from './client.expo';
import { type BuildRepository, createBuildRepository } from './builds-repo';
import { type CareRepository, createCareRepository } from './care-repo';
import { createPhotoRepository, type PhotoRepository } from './photos-repo';
import { type TerrariumDb } from './schema';
import { seedStore } from './seed';

export interface Repos {
  db: TerrariumDb;
  builds: BuildRepository;
  photos: PhotoRepository;
  careMarks: CareRepository;
}

type DbState =
  | { status: 'loading'; repos: null; error: null }
  | { status: 'ready'; repos: Repos; error: null }
  | { status: 'error'; repos: null; error: string };

const DbContext = createContext<DbState | null>(null);

export function DbProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DbState>({ status: 'loading', repos: null, error: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = createExpoDb();
        await seedStore(db);
        if (cancelled) return;
        setState({
          status: 'ready',
          repos: {
            db,
            builds: createBuildRepository(db),
            photos: createPhotoRepository(db),
            careMarks: createCareRepository(db),
          },
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setState({ status: 'error', repos: null, error: message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return <DbContext.Provider value={state}>{children}</DbContext.Provider>;
}

/** The raw DB lifecycle state (loading / ready / error) — for the root gate. */
export function useDbState(): DbState {
  const ctx = useContext(DbContext);
  if (!ctx) throw new Error('useDbState must be used inside <DbProvider>.');
  return ctx;
}

/** The repositories, once ready. Throws if read before the store has loaded. */
export function useRepos(): Repos {
  const ctx = useDbState();
  if (ctx.status !== 'ready') throw new Error('useRepos read before the store was ready.');
  return ctx.repos;
}
