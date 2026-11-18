import { jsonError } from './http.ts';

const PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/;

/** 1..max storage paths, each `{userId}/{uuid}.jpg`. Shape errors 400, foreign/odd paths 403. */
export function validatePhotoPaths(paths: unknown, userId: string, max: number): string[] | Response {
  if (!Array.isArray(paths) || paths.length < 1 || paths.length > max || !paths.every((p) => typeof p === 'string')) {
    return jsonError(400, 'Invalid request.');
  }
  if (!paths.every((p: string) => PATH.test(p) && p.startsWith(`${userId}/`))) {
    return jsonError(403, 'Not allowed.');
  }
  return paths;
}
