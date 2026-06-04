-- Global game clock shared by every connected user.
-- One row (id = 1) drives the countdown / drawing phase for the whole app
-- so all clients see the same timer and a refresh continues the same round.
CREATE TABLE IF NOT EXISTS public.game_clock (
  id int PRIMARY KEY DEFAULT 1,
  game_no int NOT NULL DEFAULT 0,
  phase text NOT NULL DEFAULT 'countdown' CHECK (phase IN ('countdown','drawing')),
  phase_started_at timestamptz NOT NULL DEFAULT now(),
  countdown_seconds int NOT NULL DEFAULT 25,
  drawing_seconds int NOT NULL DEFAULT 90,
  CONSTRAINT game_clock_single_row CHECK (id = 1)
);

INSERT INTO public.game_clock (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

GRANT SELECT ON public.game_clock TO anon, authenticated;
GRANT ALL ON public.game_clock TO service_role;

ALTER TABLE public.game_clock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "game_clock_select_all"
  ON public.game_clock
  FOR SELECT
  USING (true);

-- Atomic phase-advance helper. Anyone can call it; it only flips the phase
-- when the current phase's wall-clock duration has fully elapsed, and it
-- carries the leftover milliseconds forward so the clock never drifts.
CREATE OR REPLACE FUNCTION public.advance_game_clock()
RETURNS public.game_clock
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.game_clock;
  elapsed_ms bigint;
  phase_ms bigint;
  new_start timestamptz;
BEGIN
  SELECT * INTO row FROM public.game_clock WHERE id = 1 FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.game_clock (id) VALUES (1) RETURNING * INTO row;
  END IF;

  LOOP
    elapsed_ms := EXTRACT(EPOCH FROM (now() - row.phase_started_at)) * 1000;
    phase_ms := CASE WHEN row.phase = 'countdown'
                     THEN row.countdown_seconds * 1000
                     ELSE row.drawing_seconds * 1000
                END;
    EXIT WHEN elapsed_ms < phase_ms;
    new_start := row.phase_started_at + make_interval(secs => phase_ms / 1000.0);
    IF row.phase = 'countdown' THEN
      UPDATE public.game_clock
         SET phase = 'drawing', phase_started_at = new_start
       WHERE id = 1
       RETURNING * INTO row;
    ELSE
      UPDATE public.game_clock
         SET phase = 'countdown', phase_started_at = new_start, game_no = row.game_no + 1
       WHERE id = 1
       RETURNING * INTO row;
    END IF;
  END LOOP;

  RETURN row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.advance_game_clock() TO anon, authenticated, service_role;
