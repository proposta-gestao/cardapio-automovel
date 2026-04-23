-- Adiciona colunas para suporte a pagamentos PIX
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'dinheiro',
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pendente',
ADD COLUMN IF NOT EXISTS mp_payment_id TEXT,
ADD COLUMN IF NOT EXISTS pix_qr_code TEXT,
ADD COLUMN IF NOT EXISTS pix_qr_code_base64 TEXT;

-- Comentários das colunas
COMMENT ON COLUMN public.orders.payment_status IS 'pendente, pago, cancelado, estornado';
COMMENT ON COLUMN public.orders.payment_method IS 'pix, cartao, dinheiro';
