-- ══════════════════════════════════════════════════════════
-- BarberPro — Schema completo
-- Execute no Supabase: SQL Editor → Cole tudo → Run
-- ══════════════════════════════════════════════════════════

-- ─── EXTENSÕES ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ─── PROFILES (um por barbeiro) ─────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id        uuid REFERENCES auth.users PRIMARY KEY,
  name      text NOT NULL DEFAULT '',
  slug      text UNIQUE NOT NULL DEFAULT '',
  phone     text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- ─── BARBER CONFIG ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS barber_config (
  barber_id    uuid REFERENCES auth.users PRIMARY KEY,
  name         text DEFAULT 'Minha Barbearia',
  slot_duration integer DEFAULT 30,
  lunch_enabled boolean DEFAULT true,
  lunch_start  text DEFAULT '12:00',
  lunch_end    text DEFAULT '13:00',
  days         jsonb DEFAULT '{
    "0":{"active":false,"start":"08:00","end":"18:00"},
    "1":{"active":false,"start":"08:00","end":"18:00"},
    "2":{"active":true,"start":"09:00","end":"19:00"},
    "3":{"active":true,"start":"09:00","end":"19:00"},
    "4":{"active":true,"start":"09:00","end":"19:00"},
    "5":{"active":true,"start":"09:00","end":"19:00"},
    "6":{"active":true,"start":"08:00","end":"17:00"}
  }',
  updated_at   timestamptz DEFAULT now()
);

-- ─── CLIENTS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  barber_id  uuid REFERENCES auth.users NOT NULL,
  name       text NOT NULL,
  phone      text DEFAULT '',
  email      text DEFAULT '',
  birthday   date,
  notes      text DEFAULT '',
  has_plan   boolean DEFAULT false,
  plan_cuts  jsonb DEFAULT '[false,false,false,false]',
  plan_month text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_barber ON clients(barber_id);
CREATE INDEX IF NOT EXISTS idx_clients_phone  ON clients(barber_id, phone);
CREATE INDEX IF NOT EXISTS idx_clients_name   ON clients USING gin(unaccent(lower(name)) gin_trgm_ops);

-- ─── APPOINTMENTS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  barber_id   uuid REFERENCES auth.users NOT NULL,
  client_id   uuid REFERENCES clients(id) ON DELETE SET NULL,
  client_name text DEFAULT '',
  date        date NOT NULL,
  time        text NOT NULL,
  service     text NOT NULL DEFAULT 'cabelo',
  status      text DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled')),
  created_via text DEFAULT 'app',
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appts_barber ON appointments(barber_id);
CREATE INDEX IF NOT EXISTS idx_appts_date   ON appointments(barber_id, date);

-- Evita duplo agendamento
CREATE UNIQUE INDEX IF NOT EXISTS idx_appts_no_overlap
  ON appointments(barber_id, date, time)
  WHERE status != 'cancelled';

-- ─── BLOCKED SLOTS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blocked_slots (
  id        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  barber_id uuid REFERENCES auth.users NOT NULL,
  date      date NOT NULL,
  time      text NOT NULL,
  UNIQUE(barber_id, date, time)
);

-- ══════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════
ALTER TABLE profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE barber_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients      ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_slots ENABLE ROW LEVEL SECURITY;

-- PROFILES: dono escreve, todos leem (para busca por slug)
CREATE POLICY "profiles_owner"       ON profiles FOR ALL     USING (id = auth.uid());
CREATE POLICY "profiles_public_read" ON profiles FOR SELECT  USING (true);

-- BARBER_CONFIG: dono escreve, todos leem (para página de agendamento)
CREATE POLICY "config_owner"         ON barber_config FOR ALL    USING (barber_id = auth.uid());
CREATE POLICY "config_public_read"   ON barber_config FOR SELECT USING (true);

-- CLIENTS: somente dono
CREATE POLICY "clients_owner" ON clients FOR ALL USING (barber_id = auth.uid());

-- APPOINTMENTS: dono gerencia, público lê disponibilidade e pode inserir (agendamento)
CREATE POLICY "appts_owner"          ON appointments FOR ALL    USING (barber_id = auth.uid());
CREATE POLICY "appts_public_read"    ON appointments FOR SELECT USING (true);
CREATE POLICY "appts_public_insert"  ON appointments FOR INSERT WITH CHECK (true);

-- BLOCKED SLOTS: dono gerencia, público lê
CREATE POLICY "blocked_owner"        ON blocked_slots FOR ALL    USING (barber_id = auth.uid());
CREATE POLICY "blocked_public_read"  ON blocked_slots FOR SELECT USING (true);

-- ══════════════════════════════════════════════════════════
-- TRIGGER: cria profile + config automaticamente no signup
-- ══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 0;
  barber_name text;
BEGIN
  barber_name := coalesce(
    new.raw_user_meta_data->>'barber_name',
    split_part(new.email, '@', 1)
  );

  -- Gera slug: "Barbearia do João" → "barbearia-do-joao"
  base_slug := lower(
    regexp_replace(
      unaccent(barber_name),
      '[^a-z0-9]+', '-', 'g'
    )
  );
  base_slug := trim(both '-' from base_slug);
  final_slug := base_slug;

  -- Garante slug único
  WHILE EXISTS (SELECT 1 FROM profiles WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  -- Cria profile
  INSERT INTO profiles (id, name, slug)
  VALUES (new.id, barber_name, final_slug)
  ON CONFLICT (id) DO NOTHING;

  -- Cria config padrão
  INSERT INTO barber_config (barber_id, name)
  VALUES (new.id, barber_name)
  ON CONFLICT (barber_id) DO NOTHING;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove trigger anterior se existir
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Cria o trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
