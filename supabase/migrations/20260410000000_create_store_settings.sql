-- Create store_settings table
CREATE TABLE IF NOT EXISTS public.store_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name TEXT NOT NULL,
  address_zip TEXT,
  address_street TEXT,
  address_number TEXT,
  address_complement TEXT,
  address_reference TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view store settings" ON public.store_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage store settings" ON public.store_settings
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- Insert initial record if not exists
INSERT INTO public.store_settings (id, store_name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Minha Loja Premium')
ON CONFLICT (id) DO NOTHING;
