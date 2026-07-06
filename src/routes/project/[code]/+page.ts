import { projects } from '$lib/data/mock';

export const prerender = true;

export function entries() {
  return projects.map((p) => ({ code: p.code }));
}
