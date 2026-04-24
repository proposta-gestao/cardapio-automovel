CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'entrada' ou 'saida'
    quantity INTEGER NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso para administradores
CREATE POLICY "Admins podem ver movimentos de estoque" ON public.stock_movements
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins podem inserir movimentos de estoque" ON public.stock_movements
    FOR INSERT TO authenticated WITH CHECK (true);
