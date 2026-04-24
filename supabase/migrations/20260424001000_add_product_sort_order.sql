ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Opcional: inicializar com a ordem atual baseada na criação para manter a consistência inicial
UPDATE public.products SET sort_order = 0 WHERE sort_order IS NULL;
