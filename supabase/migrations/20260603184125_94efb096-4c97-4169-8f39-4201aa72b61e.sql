CREATE TABLE IF NOT EXISTS public.game_cartellas (
  game_no int NOT NULL,
  cartella_id int NOT NULL CHECK (cartella_id BETWEEN 1 AND 75),
  username text NOT NULL,
  stake int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (game_no, cartella_id)
);

GRANT SELECT, INSERT, DELETE ON public.game_cartellas TO anon, authenticated;
GRANT ALL ON public.game_cartellas TO service_role;

ALTER TABLE public.game_cartellas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_cartellas REPLICA IDENTITY FULL;

CREATE POLICY "game_cartellas_read_all"
  ON public.game_cartellas FOR SELECT USING (true);
CREATE POLICY "game_cartellas_insert_all"
  ON public.game_cartellas FOR INSERT WITH CHECK (true);
CREATE POLICY "game_cartellas_delete_all"
  ON public.game_cartellas FOR DELETE USING (true);

CREATE TABLE IF NOT EXISTS public.game_winners (
  game_no int PRIMARY KEY,
  username text NOT NULL,
  cartella_id int NOT NULL,
  pattern_id text NOT NULL,
  payout numeric NOT NULL DEFAULT 0,
  drawn_count int NOT NULL DEFAULT 0,
  won_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.game_winners TO anon, authenticated;
GRANT ALL ON public.game_winners TO service_role;

ALTER TABLE public.game_winners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_winners REPLICA IDENTITY FULL;

CREATE POLICY "game_winners_read_all"
  ON public.game_winners FOR SELECT USING (true);
CREATE POLICY "game_winners_insert_first"
  ON public.game_winners FOR INSERT WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.game_cartellas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_winners;