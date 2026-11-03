// Reads and writes the account's rows in Supabase for the sync engine. Row level security limits
// every request to the signed-in user's rows; user_id is still sent so upserts can match on it.
import type { SyncRemote } from '@/lib/sync-engine';
import { supabase } from '@/lib/supabase';
import { normalize, rowKey, Tables, type BadgeRow, type Rows, type Table } from '@/lib/sync';

const PageSize = 1000;
const BatchSize = 500;
/**
 * Pulls re-read this far before the cursor: a write that started before the last pull can commit
 * with an earlier updated_at. Re-applying a row is harmless.
 */
const CursorOverlapMs = 60_000;

const ConflictColumns: Record<Table, string> = {
  profiles: 'user_id',
  habits: 'user_id,id',
  habit_logs: 'user_id,habit_id,day',
  badges: 'user_id,length,earned_on',
};

async function selectAll(table: Table, userId: string, after: string | null) {
  const rows: Record<string, any>[] = [];
  for (let from = 0; ; from += PageSize) {
    let query = supabase.from(table).select('*').eq('user_id', userId);
    if (after) query = query.gt('updated_at', after);
    const { data, error } = await query.order('updated_at').range(from, from + PageSize - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PageSize) return rows;
  }
}

export const supabaseRemote: SyncRemote = {
  async push(userId, changes) {
    for (const table of Tables) {
      const upserts = changes
        .filter((change) => change.table === table && !change.remove)
        .map((change) => ({ ...change.row, user_id: userId }));
      for (let i = 0; i < upserts.length; i += BatchSize) {
        const { error } = await supabase
          .from(table)
          .upsert(upserts.slice(i, i + BatchSize), { onConflict: ConflictColumns[table] });
        if (error) throw error;
      }
    }
    for (const change of changes.filter((item) => item.remove)) {
      const badge = change.row as BadgeRow;
      const { error } = await supabase
        .from('badges')
        .delete()
        .match({ user_id: userId, length: badge.length, earned_on: badge.earned_on });
      if (error) throw error;
    }
  },

  async pull(userId, since) {
    const after = since ? new Date(Date.parse(since) - CursorOverlapMs).toISOString() : null;
    let newest = since ? Date.parse(since) : 0;
    const rows: Rows = {};
    for (const table of ['profiles', 'habits', 'habit_logs'] as const) {
      for (const raw of await selectAll(table, userId, after)) {
        const row = normalize(table, raw);
        rows[rowKey(table, row)] = row;
        newest = Math.max(newest, Date.parse(raw.updated_at));
      }
    }
    // Badges are hard-deleted, so they're always read in full (there are only a few).
    const badges: Rows = {};
    for (const raw of await selectAll('badges', userId, null)) {
      const row = normalize('badges', raw);
      badges[rowKey('badges', row)] = row;
    }
    return { rows, badges, cursor: newest ? new Date(newest).toISOString() : null };
  },
};
