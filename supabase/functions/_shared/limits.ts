import type { Deps } from './auth.ts';

export const PLANT_ID_DAILY_LIMIT = 20;
export const SEARCH_HOURLY_LIMIT = 120;

const DAY_MS = 24 * 3600_000;
const HOUR_MS = 3600_000;

async function count(db: Deps, table: string, filter: string): Promise<number> {
  const res = await db.fetch(`${db.supabaseUrl}/rest/v1/${table}?select=id&${filter}`, {
    method: 'HEAD',
    headers: { apikey: db.serviceRoleKey, authorization: `Bearer ${db.serviceRoleKey}`, prefer: 'count=exact' },
  });
  const total = Number(res.headers.get('content-range')?.split('/')[1]);
  if (!res.ok || !Number.isFinite(total)) throw new Error(`count failed (${res.status})`);
  return total;
}

/** Plant.id calls that cost credits (ok + not_plant) in the last 24 h. */
export function countRecentPlantIdCalls(db: Deps, userId: string): Promise<number> {
  const since = new Date(Date.now() - DAY_MS).toISOString();
  return count(db, 'scans', `user_id=eq.${userId}&status=in.(ok,not_plant)&created_at=gt.${since}`);
}

/** Counts the user's searches in the last hour; logs this one and returns true when under the limit. */
export async function searchAllowed(db: Deps, userId: string): Promise<boolean> {
  const since = new Date(Date.now() - HOUR_MS).toISOString();
  if ((await count(db, 'search_log', `user_id=eq.${userId}&created_at=gt.${since}`)) >= SEARCH_HOURLY_LIMIT) {
    return false;
  }
  const res = await db.fetch(`${db.supabaseUrl}/rest/v1/search_log`, {
    method: 'POST',
    headers: {
      apikey: db.serviceRoleKey,
      authorization: `Bearer ${db.serviceRoleKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!res.ok) throw new Error(`search log failed (${res.status})`);
  return true;
}
