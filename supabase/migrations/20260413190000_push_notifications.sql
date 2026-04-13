-- 1. Ativa a extensão que permite o banco de dados 'falar' com a internet
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Criar a tabela de tokens dos atendentes
CREATE TABLE IF NOT EXISTS public.atendente_tokens (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    atendente_id UUID NOT NULL REFERENCES public.atendentes(id) ON DELETE CASCADE,
    push_token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Habilitar RLS (Segurança)
ALTER TABLE public.atendente_tokens ENABLE ROW LEVEL SECURITY;

-- 4. Política para todos (simplificada para o projeto)
CREATE POLICY "Permitir gerenciamento de tokens"
  ON public.atendente_tokens
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 5. Função que chama a Edge Function 'push-notification'
CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM
    net.http_post(
      url := 'https://bpwwdnmhryblhsnywyoz.supabase.co/functions/v1/push-notification',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('record', row_to_json(NEW))
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Trigger na tabela orders
DROP TRIGGER IF EXISTS on_new_order ON public.orders;
CREATE TRIGGER on_new_order
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_order();
