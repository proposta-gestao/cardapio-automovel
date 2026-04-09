-- Add atendente columns to orders table
ALTER TABLE public.orders 
ADD COLUMN atendente_id UUID REFERENCES public.atendentes(id) ON DELETE SET NULL,
ADD COLUMN atendente_nome TEXT;

-- Update RLS policies to allow waiters to update these new columns
-- Since we already have a custom login system and the client uses the service role or a shared key,
-- we just need to ensure the columns are available for update.
