// push-notification/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts"

const FCM_PROJECT_ID = Deno.env.get('FCM_PROJECT_ID')!
const FCM_CLIENT_EMAIL = Deno.env.get('FCM_CLIENT_EMAIL')!
const FCM_PRIVATE_KEY = Deno.env.get('FCM_PRIVATE_KEY')!.replace(/\\n/g, '\n')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

async function getAccessToken(): Promise<string> {
  const jwt = await new jose.SignJWT({
    iss: FCM_CLIENT_EMAIL,
    sub: FCM_CLIENT_EMAIL,
    aud: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/cloud-platform",
  })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(await jose.importPKCS8(FCM_PRIVATE_KEY, 'RS256'))

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })
  const data = await res.json()
  return data.access_token
}

serve(async (req) => {
  try {
    const { record } = await req.json()
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: tokens } = await supabase
      .from('atendente_tokens')
      .select('push_token')

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhum token encontrado" }), { status: 200 })
    }

    const accessToken = await getAccessToken()
    const endpoint = `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`

    await Promise.all(tokens.map(async (t: any) => {
      return fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token: t.push_token,
            notification: {
              title: "🔔 Novo Pedido Recebido!",
              body: `Cliente: ${record.customer_name} | Valor: R$ ${record.total}`,
            },
            data: {
              orderId: record.id,
              url: "/atendente.html"
            }
          }
        }),
      })
    }))

    return new Response(JSON.stringify({ success: true }), { status: 200 })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
