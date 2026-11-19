import { fetchDevice } from '@/devices/api';
import { supabase } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories must be self-contained
jest.mock('@/lib/supabase', () => require('@/test-utils/supabaseMock'));

function mockRow(row: unknown) {
  const b: Record<string, jest.Mock> = {};
  b.select = jest.fn(() => b);
  b.eq = jest.fn(() => b);
  b.maybeSingle = jest.fn(async () => ({ data: row, error: null }));
  (supabase.from as jest.Mock).mockReturnValue(b);
  return b;
}

describe('fetchDevice', () => {
  it('is null without a row', async () => {
    mockRow(null);
    expect(await fetchDevice('p1')).toBeNull();
  });

  it('resumePending when any command is unacked', async () => {
    mockRow({ id: 'd1', device_commands: [{ acked_at: 'x' }, { acked_at: null }] });
    expect(await fetchDevice('p1')).toEqual({ id: 'd1', resumePending: true });
  });

  it('not pending when all are acked or none', async () => {
    mockRow({ id: 'd1', device_commands: [{ acked_at: 'x' }] });
    expect((await fetchDevice('p1'))?.resumePending).toBe(false);
    mockRow({ id: 'd1', device_commands: [] });
    expect((await fetchDevice('p1'))?.resumePending).toBe(false);
  });
});
