import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const MP_ACCESS_TOKEN = Deno.env.get('MERCADO_PAGO_TOKEN_PROD')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!MP_ACCESS_TOKEN) return new Response(JSON.stringify({ error: 'TOKEN_NOT_FOUND' }), { headers: corsHeaders })

    const { orderId } = await req.json()
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle()

    if (orderErr || !order) return new Response(JSON.stringify({ error: 'PEDIDO_NOT_FOUND: ' + orderId }), { headers: corsHeaders })

    const mpResp = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`, 
        'Content-Type': 'application/json',
        'X-Idempotency-Key': order.id // Evita pagamentos duplicados
      },
      body: JSON.stringify({
        transaction_amount: Math.round(Number(order.total) * 100) / 100, // Garante 2 casas decimais
        description: `Pedido ${order.id.slice(0,8)}`,
        payment_method_id: 'pix',
        payer: { 
          email: 'cliente@exemplo.com', 
          first_name: order.customer_name.split(' ')[0], 
          last_name: order.customer_name.split(' ').slice(1).join(' ') || 'Cliente'
        },
        external_reference: order.id,
        notification_url: `${SUPABASE_URL}/functions/v1/mercadopago-webhook`
      })
    })

    const mpData = await mpResp.json()

    if (!mpResp.ok) {
      const detail = mpData.message || mpData.description || (mpData.cause && mpData.cause[0]?.description) || 'Erro s/ msg'
      return new Response(JSON.stringify({ error: `MP_ERROR: ${detail}` }), { headers: corsHeaders })
    }

    const pixData = mpData.point_of_interaction.transaction_data;
    
    // Garantir que os campos existam antes de enviar
    const responseData = {
      qr_code: pixData.qr_code,
      qr_code_base64: pixData.qr_code_base64,
      payment_id: mpData.id
    };

    await supabase.from('orders').update({
      mp_payment_id: String(mpData.id),
      pix_qr_code: pixData.qr_code,
      pix_qr_code_base64: pixData.qr_code_base64
    }).eq('id', orderId);

    return new Response(JSON.stringify(responseData), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: 'FATAL: ' + e.message }), { headers: corsHeaders })
  }
})
