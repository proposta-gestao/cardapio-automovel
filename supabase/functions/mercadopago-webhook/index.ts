import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const MP_ACCESS_TOKEN = Deno.env.get('MERCADO_PAGO_TOKEN_PROD')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

serve(async (req) => {
  try {
    const url = new URL(req.url)

    // --- Extrai o payment ID ---
    // Produção: Mercado Pago envia JSON body com { type, data: { id } }
    // Sandbox: envia via query params ?topic=payment&id=...
    let paymentId: string | null = null
    let topic: string | null = null

    const contentType = req.headers.get('content-type') || ''
    if (req.method === 'POST' && contentType.includes('application/json')) {
      const body = await req.json().catch(() => ({}))
      topic = body.type || body.topic || url.searchParams.get('topic') || url.searchParams.get('type')
      paymentId = body.data?.id || url.searchParams.get('id') || url.searchParams.get('data.id')
    } else {
      topic = url.searchParams.get('topic') || url.searchParams.get('type')
      paymentId = url.searchParams.get('id') || url.searchParams.get('data.id')
    }

    // Responde imediatamente ao MP (exige resposta rápida < 5s)
    if (!paymentId || (topic !== 'payment' && topic !== 'merchant_order')) {
      return new Response('Ignored', { status: 200 })
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

    // 1. Busca detalhes do pagamento no Mercado Pago
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` }
    })
    const mpData = await response.json()

    if (mpData.status === 'approved') {
      const orderId = mpData.external_reference

      if (!orderId) {
        console.error('Webhook: external_reference ausente no pagamento', paymentId)
        return new Response('OK', { status: 200 })
      }

      // 2. Atualiza o status do pedido para PAGO
      const { error } = await supabase
        .from('orders')
        .update({
          payment_status: 'pago',
          status: 'preparando'
        })
        .eq('id', orderId)
        .eq('payment_status', 'pendente') // Segurança: idempotência

      if (error) console.error('Erro ao atualizar pedido:', error)
      else console.log(`Pedido ${orderId} confirmado como PAGO. MP payment_id: ${paymentId}`)
    } else {
      console.log(`Webhook recebido, status: ${mpData.status} (não aprovado, ignorado)`)
    }

    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('Webhook Error:', error.message)
    return new Response('Error', { status: 500 })
  }
})

