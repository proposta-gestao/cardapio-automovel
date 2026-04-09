-- Enable RLS for clientes if not already
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- Allow anyone (public clients checkout) to insert into clientes table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'clientes' AND policyname = 'Anyone can insert clientes'
    ) THEN
        CREATE POLICY "Anyone can insert clientes" ON public.clientes
            FOR INSERT WITH CHECK (true);
    END IF;
END
$$;
