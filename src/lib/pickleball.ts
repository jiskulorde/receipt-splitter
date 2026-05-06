/* eslint-disable @typescript-eslint/no-explicit-any */
/* src/lib/pickleball.ts */
import { supabaseBrowser } from "@/src/lib/supabase/client";

export type PickleballEntranceFeeMode =
  | "individual"
  | "paid_first"
  | "some_paid_own";

export type PickleballSessionPlayer = {
  id: string;
  session_id: string;
  group_id: string;
  player_user_id: string | null;
  player_name: string;
  amount_due: number;
  is_paid: boolean;
  paid_at: string | null;
  note: string | null;
  entrance_paid_own: boolean;
  created_at: string;
  updated_at: string;
};

export type PickleballSession = {
  id: string;
  group_id: string;
  collection_id: string | null;
  sport_type: "pickleball";
  title: string;
  session_date: string | null;
  time_label: string | null;
  court_note: string | null;
  amount_per_player: number;
  entrance_fee_per_person: number;
  entrance_paid_individually: boolean;
  entrance_fee_mode: PickleballEntranceFeeMode;
  entrance_paid_by_user_id: string | null;
  court_paid_by_user_id: string | null;
  collector_user_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type PickleballSessionWithPlayers = PickleballSession & {
  players: PickleballSessionPlayer[];
};

export type CreatePickleballSessionInput = {
  groupId: string;
  collectionId?: string | null;
  title: string;
  sessionDate?: string | null;
  timeLabel?: string | null;
  courtNote?: string | null;
  amountPerPlayer: number;
  entranceFeePerPerson?: number;
  entranceFeeMode?: PickleballEntranceFeeMode;
  entrancePaidByUserId?: string | null;
  entrancePaidIndividually?: boolean;
  courtPaidByUserId?: string | null;
  collectorUserId?: string | null;
  players: Array<{
    playerUserId?: string | null;
    playerName: string;
    amountDue: number;
    isPaid: boolean;
    entrancePaidOwn?: boolean;
    note?: string | null;
  }>;
};

function normalizeMoney(value: number) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function mapSession(row: any): PickleballSession {
  return {
    id: row.id,
    group_id: row.group_id,
    collection_id: row.collection_id ?? null,
    sport_type: row.sport_type,
    title: row.title,
    session_date: row.session_date,
    time_label: row.time_label,
    court_note: row.court_note,
    amount_per_player: Number(row.amount_per_player ?? 0),
    entrance_fee_per_person: Number(row.entrance_fee_per_person ?? 0),
    entrance_paid_individually: !!row.entrance_paid_individually,
    entrance_fee_mode: (row.entrance_fee_mode ?? "individual") as PickleballEntranceFeeMode,
    entrance_paid_by_user_id: row.entrance_paid_by_user_id ?? null,
    court_paid_by_user_id: row.court_paid_by_user_id,
    collector_user_id: row.collector_user_id,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapPlayer(row: any): PickleballSessionPlayer {
  return {
    id: row.id,
    session_id: row.session_id,
    group_id: row.group_id,
    player_user_id: row.player_user_id,
    player_name: row.player_name,
    amount_due: Number(row.amount_due ?? 0),
    is_paid: !!row.is_paid,
    paid_at: row.paid_at,
    note: row.note,
    entrance_paid_own: !!row.entrance_paid_own,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function listPickleballSessions(
  input:
    | string
    | {
        groupId: string;
        collectionId?: string | null;
      }
) {
  const supabase = supabaseBrowser();

  const params =
    typeof input === "string"
      ? {
          groupId: input,
          collectionId: null,
        }
      : {
          groupId: input.groupId,
          collectionId: input.collectionId ?? null,
        };

  let query = supabase
    .from("sports_sessions")
    .select("*, players:sports_session_players(*)")
    .eq("group_id", params.groupId)
    .eq("sport_type", "pickleball");

  if (params.collectionId) {
    query = query.eq("collection_id", params.collectionId);
  }

  const { data, error } = await query
    .order("session_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as any[]).map((row) => {
    const players = ((row.players ?? []) as any[])
      .map(mapPlayer)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));

    return {
      ...mapSession(row),
      players,
    };
  }) as PickleballSessionWithPlayers[];
}

export async function createPickleballSession(input: CreatePickleballSessionInput) {
  const supabase = supabaseBrowser();

  const entranceMode = input.entranceFeeMode ?? "individual";

  const { data: session, error: sessionError } = await supabase
    .from("sports_sessions")
    .insert({
      group_id: input.groupId,
      collection_id: input.collectionId ?? null,
      sport_type: "pickleball",
      title: input.title.trim(),
      session_date: input.sessionDate || null,
      time_label: input.timeLabel?.trim() || null,
      court_note: input.courtNote?.trim() || null,
      amount_per_player: normalizeMoney(input.amountPerPlayer),
      entrance_fee_per_person: normalizeMoney(input.entranceFeePerPerson ?? 0),
      entrance_paid_individually: entranceMode === "individual",
      entrance_fee_mode: entranceMode,
      entrance_paid_by_user_id: input.entrancePaidByUserId || null,
      court_paid_by_user_id: input.courtPaidByUserId || null,
      collector_user_id: input.collectorUserId || null,
    })
    .select("*")
    .single();

  if (sessionError) throw sessionError;

  const rows = input.players.map((p) => ({
    session_id: session.id,
    group_id: input.groupId,
    player_user_id: p.playerUserId || null,
    player_name: p.playerName.trim(),
    amount_due: normalizeMoney(p.amountDue),
    is_paid: !!p.isPaid,
    paid_at: p.isPaid ? new Date().toISOString() : null,
    entrance_paid_own: !!p.entrancePaidOwn,
    note: p.note?.trim() || null,
  }));

  if (rows.length > 0) {
    const { error: playersError } = await supabase
      .from("sports_session_players")
      .insert(rows);

    if (playersError) throw playersError;
  }

  return session.id as string;
}

export async function setPickleballPlayerPaid(playerId: string, isPaid: boolean) {
  const supabase = supabaseBrowser();

  const { error } = await supabase
    .from("sports_session_players")
    .update({
      is_paid: isPaid,
      paid_at: isPaid ? new Date().toISOString() : null,
    })
    .eq("id", playerId);

  if (error) throw error;
}

export async function markPickleballSessionAllPaid(
  sessionId: string,
  isPaid: boolean
) {
  const supabase = supabaseBrowser();

  const { error } = await supabase
    .from("sports_session_players")
    .update({
      is_paid: isPaid,
      paid_at: isPaid ? new Date().toISOString() : null,
    })
    .eq("session_id", sessionId);

  if (error) throw error;
}

export async function deletePickleballSession(sessionId: string) {
  const supabase = supabaseBrowser();

  const { error } = await supabase
    .from("sports_sessions")
    .delete()
    .eq("id", sessionId);

  if (error) throw error;
}