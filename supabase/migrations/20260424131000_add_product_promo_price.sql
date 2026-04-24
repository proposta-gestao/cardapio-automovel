-- Add promotional price column to products table
ALTER TABLE public.products
ADD COLUMN promo_price NUMERIC(10,2) DEFAULT NULL;

-- Ensure RLS allows access to this column (usually automatic for public columns)
COMMENT ON COLUMN public.products.promo_price IS 'Preço promocional do produto. Se maior que zero, substitui o preço original na exibição.';
