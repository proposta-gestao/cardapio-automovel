ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS cancellation_reasons JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
