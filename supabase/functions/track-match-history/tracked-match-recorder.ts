/** The one call this module makes on the database client, so a test can stand in for it. */
export interface RecorderTable {
  from(table: 'tracked_match_recorders'): {
    upsert(
      row: { tracked_match_id: number; recorded_by: string; recorded_at: string },
      options: { onConflict: string },
    ): PromiseLike<{ error: { message: string } | null }>;
  };
}

/**
 * Notes which verified recorder uploaded a tracked match, in a table clients cannot read. A repeat
 * upload replaces the match's stored payload, so it also replaces the recorder and its time. The match is already
 * stored, so a failed write (including a migration not applied yet) is logged and the upload still
 * succeeds.
 */
export async function recordTrackedMatchRecorder(
  supabase: RecorderTable,
  trackedMatchId: number,
  recordedBy: string,
): Promise<void> {
  try {
    const { error } = await supabase
      .from('tracked_match_recorders')
      .upsert(
        { tracked_match_id: trackedMatchId, recorded_by: recordedBy, recorded_at: new Date().toISOString() },
        { onConflict: 'tracked_match_id' },
      );
    if (error) throw new Error(error.message);
  } catch (error) {
    console.error(`Tracked match recorder not stored: ${error instanceof Error ? error.message : String(error)}`);
  }
}
