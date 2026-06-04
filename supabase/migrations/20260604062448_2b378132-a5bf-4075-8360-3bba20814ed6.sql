
CREATE TABLE public.tg_users (
  telegram_id bigint PRIMARY KEY,
  phone text NOT NULL,
  first_name text,
  tg_username text,
  app_username text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tg_users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tg_users TO anon;
GRANT ALL ON public.tg_users TO service_role;

ALTER TABLE public.tg_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY tg_users_read_all ON public.tg_users FOR SELECT USING (true);
CREATE POLICY tg_users_insert_all ON public.tg_users FOR INSERT WITH CHECK (true);
CREATE POLICY tg_users_update_all ON public.tg_users FOR UPDATE USING (true) WITH CHECK (true);
