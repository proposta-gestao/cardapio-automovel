import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const MP_ACCESS_TOKEN = Deno.env.get('MERCADO_PAGO_TOKEN_PROD')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

serve(async (req) => {
  try {
    const url = new URL(req.url)
    console.log(`[Webhook] Nova requisição: ${req.method} ${url.pathname}${url.search}`)

    let paymentId: string | null = null
    let topic: string | null = null

    const contentType = req.headers.get('content-type') || ''
    
    if (req.method === 'POST') {
      if (contentType.includes('application/json')) {
        const body = await req.json().catch(() => ({}))
        console.log('[Webhook] Body JSON recebido:', JSON.stringify(body))
        
        topic = body.type || body.topic || url.searchParams.get('topic') || url.searchParams.get('type') || body.action
        paymentId = body.data?.id || body.id || url.searchParams.get('id') || url.searchParams.get('data.id')
      } else {
        const text = await req.text().catch(() => '')
        console.log('[Webhook] Body Text recebido:', text)
        topic = url.searchParams.get('topic') || url.searchParams.get('type')
        paymentId = url.searchParams.get('id') || url.searchParams.get('data.id')
      }
    } else {
      topic = url.searchParams.get('topic') || url.searchParams.get('type')
      paymentId = url.searchParams.get('id') || url.searchParams.get('data.id')
    }

    console.log(`[Webhook] Resolvido -> Topic/Type: ${topic}, PaymentId: ${paymentId}`)

    if (!paymentId) {
      console.log('[Webhook] Ignorado: Nenhum ID de pagamento encontrado.')
      return new Response('Ignored', { status: 200 })
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

    // 1. Busca detalhes do pagamento no Mercado Pago
    console.log(`[Webhook] Buscando detalhes do pagamento ${paymentId} na API do Mercado Pago...`)
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` }
    })
    const mpData = await response.json()
    
    console.log(`[Webhook] Dados do pagamento MP: Status=${mpData.status}, Ref=${mpData.external_reference}`)

    if (mpData.status === 'approved') {
      const orderId = mpData.external_reference

      if (!orderId) {
        console.error(`[Webhook] ERRO: external_reference não definido no pagamento ${paymentId}`)
        return new Response('OK', { status: 200 })
      }

      console.log(`[Webhook] Pagamento aprovado! Atualizando pedido ${orderId} no Supabase...`)

      // 2. Atualiza o status do pagamento para PAGO, mas mantém o status do pedido como pendente
      const { error, data } = await supabase
        .from('orders')
        .update({
          payment_status: 'pago'
        })
        .eq('id', orderId)
        .select()

      if (error) {
        console.error('[Webhook] ERRO ao atualizar pedido no Supabase:', error)
      } else if (data && data.length === 0) {
        console.warn(`[Webhook] AVISO: Nenhum pedido atualizado. Talvez o ID ${orderId} não exista.`)
      } else {
        console.log(`[Webhook] SUCESSO! Pedido ${orderId} atualizado no banco.`)
      }
    } else {
      console.log(`[Webhook] Pagamento não aprovado (Status atual: ${mpData.status}). Nenhuma ação necessária.`)
    }

    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('[Webhook] ERRO FATAL:', error)
    return new Response('Error', { status: 500 })
  }
})

