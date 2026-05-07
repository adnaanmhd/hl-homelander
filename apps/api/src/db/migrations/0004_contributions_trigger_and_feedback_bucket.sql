-- 0004 — contributions denormalization trigger so GET /contributions/timeseries
-- can read directly from the contributions table without expensive aggregation.
-- Fires on INSERT/UPDATE/DELETE of recordings; updates the (user_id, bucket_date)
-- row with bucket_date = (captured_at AT TIME ZONE 'UTC')::date.
--
-- The trigger filters qa_status NOT IN ('takedown', 'rejected') per D-LEGAL-04,
-- so takedown / rejected recordings never contribute to the user-visible time
-- series. The /contributions lifetime aggregate (routes/contributions/list.ts)
-- applies the same filter at query time for symmetry.

CREATE OR REPLACE FUNCTION refresh_contribution_bucket(p_user_id varchar, p_captured_at timestamptz)
  RETURNS void AS $$
DECLARE
  v_bucket text := to_char((p_captured_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD');
  v_duration bigint;
  v_count integer;
  v_tasks integer;
BEGIN
  SELECT
    COALESCE(SUM(duration_ms), 0)::bigint,
    COALESCE(COUNT(*), 0)::int,
    COALESCE(COUNT(DISTINCT task_id), 0)::int
  INTO v_duration, v_count, v_tasks
  FROM recordings
  WHERE user_id = p_user_id
    AND (captured_at AT TIME ZONE 'UTC')::date = (p_captured_at AT TIME ZONE 'UTC')::date
    AND qa_status NOT IN ('takedown', 'rejected');

  -- If the bucket is now empty (e.g. last recording for the day deleted or
  -- transitioned to takedown), delete the row instead of leaving a zeroed
  -- artifact in the time series.
  IF v_count = 0 THEN
    DELETE FROM contributions WHERE user_id = p_user_id AND bucket_date = v_bucket;
    RETURN;
  END IF;

  INSERT INTO contributions (user_id, bucket_date, duration_ms, recording_count, task_count)
  VALUES (p_user_id, v_bucket, v_duration, v_count, v_tasks)
  ON CONFLICT (user_id, bucket_date) DO UPDATE SET
    duration_ms = EXCLUDED.duration_ms,
    recording_count = EXCLUDED.recording_count,
    task_count = EXCLUDED.task_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION recordings_contributions_trigger()
  RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM refresh_contribution_bucket(NEW.user_id, NEW.captured_at);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM refresh_contribution_bucket(NEW.user_id, NEW.captured_at);
    IF OLD.user_id <> NEW.user_id OR OLD.captured_at <> NEW.captured_at THEN
      PERFORM refresh_contribution_bucket(OLD.user_id, OLD.captured_at);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM refresh_contribution_bucket(OLD.user_id, OLD.captured_at);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS recordings_contributions_trigger_t ON recordings;
CREATE TRIGGER recordings_contributions_trigger_t
  AFTER INSERT OR UPDATE OR DELETE ON recordings
  FOR EACH ROW EXECUTE FUNCTION recordings_contributions_trigger();
