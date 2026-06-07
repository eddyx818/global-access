import { supabase } from './supabase';

export async function fetchLobbyLeaderboard(limit = 8) {
  const { data, error } = await supabase
    .from('lobby_game_scores')
    .select('player_name, score, products_collected, created_at')
    .order('score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return { ok: false, error: error.message, rows: [] };
  return { ok: true, rows: data || [] };
}

export async function submitLobbyScore({ playerName, score, productsCollected }) {
  const name = (playerName || 'Guest').trim().slice(0, 40);
  const { error } = await supabase.from('lobby_game_scores').insert({
    player_name: name || 'Guest',
    score: Math.max(0, Math.floor(score)),
    products_collected: Math.max(0, Math.floor(productsCollected || 0)),
    created_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Portal admins only — requires reset_lobby_game_scores() RPC in Supabase. */
export async function resetLobbyLeaderboard() {
  const { data, error } = await supabase.rpc('reset_lobby_game_scores');
  if (error) return { ok: false, error: error.message };
  return { ok: true, deleted: data ?? 0 };
}
