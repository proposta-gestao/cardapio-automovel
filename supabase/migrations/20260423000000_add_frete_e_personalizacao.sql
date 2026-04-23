-- ============================================================
-- Migration: Frete + Personalização Visual
-- Adiciona campos faltantes em store_settings e garante
-- que shipping_zones tem RLS adequada para leitura pública.
-- ============================================================

-- 1. Campos de endereço que faltavam na store_settings
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS address_neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS address_city         TEXT,
  ADD COLUMN IF NOT EXISTS address_state        TEXT;

-- 2. Controle de frete
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS frete_ativo BOOLEAN DEFAULT false;

-- 3. Personalização visual
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS brand_name     TEXT,
  ADD COLUMN IF NOT EXISTS brand_subtitle TEXT,
  ADD COLUMN IF NOT EXISTS banner_url     TEXT,
  ADD COLUMN IF NOT EXISTS logo_url       TEXT;

-- 4. Garantir que shipping_zones existe e tem RLS pública de leitura
CREATE TABLE IF NOT EXISTS public.shipping_zones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  min_zip     TEXT,
  max_zip     TEXT,
  fee         NUMERIC(10,2) NOT NULL DEFAULT 0,
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;

-- Leitura pública (necessário para o front calcular frete sem login)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'shipping_zones' AND policyname = 'Public read shipping zones'
  ) THEN
    EXECUTE 'CREATE POLICY "Public read shipping zones" ON public.shipping_zones
             FOR SELECT USING (true)';
  END IF;
END $$;

-- Escrita apenas para admins autenticados
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'shipping_zones' AND policyname = 'Admins manage shipping zones'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins manage shipping zones" ON public.shipping_zones
             FOR ALL TO authenticated
             USING (public.is_admin(auth.uid()))';
  END IF;
END $$;
