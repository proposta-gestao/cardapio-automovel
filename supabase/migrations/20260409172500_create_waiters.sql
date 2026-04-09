-- Create waiters table (atendentes)
CREATE TABLE public.atendentes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    cpf TEXT NOT NULL UNIQUE,
    senha TEXT NOT NULL, -- Storing as plain text for now as per simple request, but can be hashed
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for atendentes
ALTER TABLE public.atendentes ENABLE ROW LEVEL SECURITY;

-- Policy to allow anonymous check for login (only for this specific purpose)
-- In a real production app, we'd use Supabase Auth properly.
CREATE POLICY "Anyone can view waiters for login" ON public.atendentes
    FOR SELECT USING (true);

-- Enable Realtime for orders table
-- This allows the frontend to receive events when new rows are inserted
ALTER TABLE public.orders REPLICA IDENTITY FULL;

-- Add a seed waiter for testing
-- User: 123.456.789-00 / Senha: 123
INSERT INTO public.atendentes (nome, cpf, senha)
VALUES ('Atendente Teste', '12345678900', '123')
ON CONFLICT (cpf) DO NOTHING;
