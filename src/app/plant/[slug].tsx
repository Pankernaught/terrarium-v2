/**
 * Plant detail route — retired. Plant information is now served by the shared
 * PlantSheet component (opened from Browse, the planner catalog, and build
 * detail). This redirect exists so any deep-linked or cached URL doesn't 404.
 */
import { Redirect } from 'expo-router';

export default function PlantRoute() {
  return <Redirect href="/browse" />;
}
