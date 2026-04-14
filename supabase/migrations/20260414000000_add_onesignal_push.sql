-- Habilita a extensão pg_net (Padrão no Supabase para requisições HTTP REST dentro do banco)
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";

-- 1. Adiciona a coluna para guardar o Token Push (Player ID) de cada atendente
ALTER TABLE public.atendentes ADD COLUMN IF NOT EXISTS onesignal_id TEXT;

-- 2. Cria a função de trigger para disparar o Push Notification via requisição POST
CREATE OR REPLACE FUNCTION notify_new_order_onesignal()
RETURNS TRIGGER AS $$
DECLARE
    json_body JSONB;
    request_id BIGINT;
    player_ids JSONB;
BEGIN
    -- Busca todos os onesignal_ids cadastrados (que não são nulos) para notificar TODOS os atendentes
    SELECT jsonb_agg(onesignal_id) INTO player_ids
    FROM public.atendentes
    WHERE onesignal_id IS NOT NULL AND onesignal_id != '';

    -- Se não tem ninguém com notificações ativas, sai da função silenciosamente
    IF player_ids IS NULL OR jsonb_array_length(player_ids) = 0 THEN
        RETURN NEW;
    END IF;

    -- Constrói o corpo da requisição para a API da OneSignal
    json_body := jsonb_build_object(
        'app_id', 'c7223246-03a4-4fff-b9f3-f6217b183917',
        'include_player_ids', player_ids,
        'headings', jsonb_build_object('en', '🔔 Novo Pedido # ' || left(NEW.id::text, 8)),
        'contents', jsonb_build_object('en', 'Cliente: ' || NEW.customer_name),
        'android_sound', 'notification',
        'android_channel_id', 'pedidos_urgentes' -- Se for criar um canal com prioridade e som ignorando DND no OneSignal
    );

    -- 3. Dispara a requisição HTTP POST assíncrona (não atrasa o insert da tabela)
    SELECT net.http_post(
        url := 'https://onesignal.com/api/v1/notifications',
        headers := '{"Content-Type": "application/json", "Authorization": "Basic os_v2_app_y4rderqdurh77opt6yqxwgbzc4ji7aqiedseuoer7lfsfbaszonw2na6y3ydoqus5465jwari3rqgvxbghmziyq7oowc6vafy"}'::jsonb,
        body := json_body
    ) INTO request_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Associa a Trigger à tabela de pedidos (somente no INSERT e quando for pedido novo = pendente)
DROP TRIGGER IF EXISTS trg_new_order_onesignal ON public.orders;
CREATE TRIGGER trg_new_order_onesignal
    AFTER INSERT ON public.orders
    FOR EACH ROW
    WHEN (NEW.status = 'pendente')
    EXECUTE FUNCTION notify_new_order_onesignal();
