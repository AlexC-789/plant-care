import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useSession } from '@/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import {
  useCheckHealth,
  useCreatePlant,
  useDeletePlant,
  useIdentify,
  usePlants,
  useSpeciesSearch,
} from '@/plants/queries';
import { createQueryWrapper } from '@/test-utils/queryWrapper';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories must be self-contained
jest.mock('@/lib/supabase', () => require('@/test-utils/supabaseMock'));
jest.mock('@/auth/AuthProvider', () => ({ useSession: jest.fn() }));

const USER_ID = '11111111-1111-1111-1111-111111111111';
const bucket = { remove: jest.fn(), createSignedUrls: jest.fn() };

type Result = { data?: unknown; error?: unknown };
/** Chainable, awaitable stand-in for supabase.from(table); every call is recorded in `calls`. */
function mockTables(results: Record<string, Result | Result[]>) {
  const calls: { table: string; method: string; args: unknown[] }[] = [];
  (supabase.from as jest.Mock).mockImplementation((table: string) => {
    calls.push({ table, method: 'from', args: [table] });
    const r = results[table];
    const settle = () => (Array.isArray(r) ? (r.length > 1 ? r.shift()! : r[0]) : r) ?? { data: null, error: null };
    const builder: Record<string, unknown> = {};
    for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'order', 'range', 'limit', 'ilike', 'in']) {
      builder[m] = jest.fn((...args: unknown[]) => {
        calls.push({ table, method: m, args });
        return builder;
      });
    }
    builder.single = jest.fn(async () => settle());
    builder.maybeSingle = builder.single;
    builder.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
      Promise.resolve(settle()).then(res, rej);
    return builder;
  });
  return calls;
}

let wrapper: ReturnType<typeof createQueryWrapper>['wrapper'];
let client: ReturnType<typeof createQueryWrapper>['client'];

beforeEach(() => {
  ({ wrapper, client } = createQueryWrapper());
  jest.clearAllMocks();
  (useSession as jest.Mock).mockReturnValue({ session: { user: { id: USER_ID } }, isLoading: false });
  (supabase.storage.from as jest.Mock).mockReturnValue(bucket);
  bucket.remove.mockResolvedValue({ error: null });
  bucket.createSignedUrls.mockResolvedValue({ data: [], error: null });
});

describe('usePlants', () => {
  it('pages 20 at a time, newest first, signing the page photos in one call', async () => {
    const plants = [
      { id: 'p1', photo_path: 'u/a.jpg' },
      { id: 'p2', photo_path: null },
    ];
    const calls = mockTables({ plants: { data: plants, error: null } });
    bucket.createSignedUrls.mockResolvedValue({ data: [{ path: 'u/a.jpg', signedUrl: 'https://s/a' }], error: null });
    const { result } = await renderHook(() => usePlants(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.pages[0]).toEqual({ plants, photoUrls: { 'u/a.jpg': 'https://s/a' } });
    expect(calls).toContainEqual({ table: 'plants', method: 'range', args: [0, 19] });
    expect(calls).toContainEqual({ table: 'plants', method: 'order', args: ['created_at', { ascending: false }] });
    expect(bucket.createSignedUrls).toHaveBeenCalledWith(['u/a.jpg'], 3600);
    expect(result.current.hasNextPage).toBe(false);
  });
});

describe('useCreatePlant', () => {
  it('inserts the plant, then links the scan to it', async () => {
    const calls = mockTables({ plants: { data: { id: 'p1', name: 'Fern' }, error: null }, scans: { error: null } });
    const { result } = await renderHook(() => useCreatePlant(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ name: 'Fern', speciesId: 's1', photoPath: 'u/a.jpg', scanId: 'scan1' });
    });
    expect(calls).toContainEqual({
      table: 'plants',
      method: 'insert',
      args: [{ name: 'Fern', species_id: 's1', photo_path: 'u/a.jpg', room: undefined, custom_type: undefined }],
    });
    expect(calls).toContainEqual({ table: 'scans', method: 'update', args: [{ plant_id: 'p1' }] });
    expect(calls).toContainEqual({ table: 'scans', method: 'eq', args: ['id', 'scan1'] });
  });

  it('deletes the just-inserted plant and rethrows when the scan link fails', async () => {
    const calls = mockTables({
      plants: [{ data: { id: 'p1' }, error: null }, { error: { message: 'delete failed' } }],
      scans: { error: { message: 'link failed' } },
    });
    const { result } = await renderHook(() => useCreatePlant(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync({ name: 'Fern', scanId: 'scan1' })).rejects.toEqual({
        message: 'link failed',
      });
    });
    expect(calls).toContainEqual({ table: 'plants', method: 'delete', args: [] });
    expect(calls).toContainEqual({ table: 'plants', method: 'eq', args: ['id', 'p1'] });
  });

  it('does not touch scans without a scanId', async () => {
    const calls = mockTables({ plants: { data: { id: 'p1' }, error: null } });
    const { result } = await renderHook(() => useCreatePlant(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ name: 'Fern' });
    });
    expect(calls.some((c) => c.table === 'scans')).toBe(false);
  });
});

describe('useDeletePlant', () => {
  it('deletes the row, then removes the plant photo and every scan photo', async () => {
    const calls = mockTables({
      plants: [{ data: { photo_path: 'u/main.jpg' }, error: null }, { error: null }],
      scans: { data: [{ photo_paths: ['u/s1.jpg', 'u/s2.jpg'] }, { photo_paths: ['u/s3.jpg'] }], error: null },
    });
    client.setQueryData(['plant', 'p1'], { id: 'p1' });
    client.setQueryData(['plants', USER_ID], {
      pages: [{ plants: [{ id: 'p1' }, { id: 'p2' }], photoUrls: {} }],
      pageParams: [0],
    });
    const { result } = await renderHook(() => useDeletePlant(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync('p1');
    });
    expect(calls.map((c) => `${c.table}.${c.method}`)).toContain('plants.delete');
    expect(bucket.remove).toHaveBeenCalledWith(['u/main.jpg', 'u/s1.jpg', 'u/s2.jpg', 'u/s3.jpg']);
    expect(client.getQueryData(['plant', 'p1'])).toBeUndefined();
    expect(
      (client.getQueryData(['plants', USER_ID]) as { pages: { plants: { id: string }[] }[] }).pages[0].plants,
    ).toEqual([{ id: 'p2' }]);
  });

  it('keeps the photos when the row delete fails', async () => {
    mockTables({
      plants: [{ data: { photo_path: 'u/main.jpg' }, error: null }, { error: { message: 'denied' } }],
      scans: { data: [], error: null },
    });
    const { result } = await renderHook(() => useDeletePlant(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync('p1')).rejects.toBeTruthy();
    });
    expect(bucket.remove).not.toHaveBeenCalled();
  });
});

describe('useSpeciesSearch', () => {
  const local = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `s${i}`, scientific_name: `Sci ${i}` }));

  it('uses local results only when there are 3 or more', async () => {
    const calls = mockTables({ species: { data: local(3), error: null } });
    const { result } = await renderHook(() => useSpeciesSearch('mon'), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual({ local: local(3), more: [] });
    expect(calls).toContainEqual({ table: 'species', method: 'ilike', args: ['search_text', '%mon%'] });
    expect(calls).toContainEqual({ table: 'species', method: 'limit', args: [20] });
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('escapes % and _ in the query', async () => {
    const calls = mockTables({ species: { data: local(3), error: null } });
    const { result } = await renderHook(() => useSpeciesSearch('a%_b'), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(calls).toContainEqual({ table: 'species', method: 'ilike', args: ['search_text', '%a\\%\\_b%'] });
  });

  it('falls back to search-plants when local < 3, deduped by scientific name', async () => {
    mockTables({ species: { data: local(1), error: null } });
    (supabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: {
        hits: [
          { commonName: 'Dup', scientificName: 'Sci 0' },
          { commonName: 'New', scientificName: 'Novus plantus' },
        ],
      },
      error: null,
    });
    const { result } = await renderHook(() => useSpeciesSearch('mon'), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(supabase.functions.invoke).toHaveBeenCalledWith('search-plants', { body: { query: 'mon' } });
    expect(result.current.data?.more).toEqual([{ commonName: 'New', scientificName: 'Novus plantus' }]);
  });

  it('keeps local results when the Plant.id search fails', async () => {
    mockTables({ species: { data: local(1), error: null } });
    (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: null, error: { message: 'down' } });
    const { result } = await renderHook(() => useSpeciesSearch('mon'), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual({ local: local(1), more: [] });
  });

  it('does not call search-plants for a 1-character query', async () => {
    mockTables({ species: { data: [], error: null } });
    const { result } = await renderHook(() => useSpeciesSearch('m'), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
    expect(result.current.data?.more).toEqual([]);
  });
});

describe('edge functions', () => {
  it('identify sends only photoPaths and returns the result', async () => {
    (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: { isPlant: true }, error: null });
    const { result } = await renderHook(() => useIdentify(), { wrapper });
    let out: unknown;
    await act(async () => {
      out = await result.current.mutateAsync(['u/a.jpg']);
    });
    expect(supabase.functions.invoke).toHaveBeenCalledWith('identify-plant', { body: { photoPaths: ['u/a.jpg'] } });
    expect(out).toEqual({ isPlant: true });
  });

  it('surfaces the server error message on a non-2xx', async () => {
    (supabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: null,
      error: { context: { json: async () => ({ error: 'Daily limit reached.' }) } },
    });
    const { result } = await renderHook(() => useCheckHealth(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync({ plantId: 'p1', photoPaths: ['u/a.jpg'] })).rejects.toThrow(
        'Daily limit reached.',
      );
    });
    expect(supabase.functions.invoke).toHaveBeenCalledWith('check-health', {
      body: { plantId: 'p1', photoPaths: ['u/a.jpg'] },
    });
  });
});
