// Ring one-way account linking:
//   POST /ring/token  — Token Exchange URL: Ring POSTs an authorization code (form-encoded); we exchange it
//                       within 60 s, look up the Ring account id, and park the tokens as "unclaimed".
//   GET  /ring/link   — Account Link URL: Ring redirects the user here with ?nonce&time. Ring requires a sign-in
//                       form here; we also show what DeliveryHub will access (consent).
//   POST /ring/link   — Sign-in submit: verify the homeowner, match the nonce to an unclaimed token,
//                       POST + PATCH app-integrations, map the account's doorbells to the home.
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { DEMO_HOME_ID } from '../core/demo.js'
import { audit, deleteUnclaimed, getHome, listUnclaimed, putHome, putUnclaimed, saveRingTokens } from '../lib/store.js'
import { completeIntegration, exchangeCode, getAccountId, listDeviceIds } from '../ring/client.js'
import { linkFreshness, maskEmail, nonceMatches, safeEqual } from '../ring/linking.js'

const html = (statusCode: number, body: string): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-frame-options': 'DENY' },
  body: page(body),
})
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const form = (e: APIGatewayProxyEventV2) =>
  new URLSearchParams(e.isBase64Encoded ? Buffer.from(e.body ?? '', 'base64').toString('utf8') : (e.body ?? ''))

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const method = event.requestContext.http.method
  const path = event.rawPath
  try {
    if (method === 'POST' && path === '/ring/token') return await tokenExchange(event)
    if (method === 'GET' && path === '/ring/link') return linkPage(event.queryStringParameters?.nonce ?? '', event.queryStringParameters?.time ?? '')
    if (method === 'POST' && path === '/ring/link') return await linkSubmit(event)
    return { statusCode: 404, body: 'not found' }
  } catch (e) {
    console.error(JSON.stringify({ msg: 'ring_auth_error', path, error: String(e) }))
    return path === '/ring/token' ? { statusCode: 500, body: 'error' } : html(500, `<h1>Something went wrong</h1><p>Please try connecting again from the Ring app.</p>`)
  }
}

async function tokenExchange(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const code = form(event).get('code')
  if (!code) return { statusCode: 400, body: 'missing code' }
  const tokens = await exchangeCode(code)
  const accountId = await getAccountId(tokens.accessToken)
  await putUnclaimed({ ...tokens, accountId, receivedAt: Date.now() })
  console.log(JSON.stringify({ msg: 'ring_token_received', accountIdSuffix: accountId.slice(-4) }))
  return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: '{"status":"ok"}' }
}

function linkPage(nonce: string, time: string, error?: string): APIGatewayProxyResultV2 {
  const fresh = linkFreshness(time, Date.now())
  if (!nonce || fresh !== 'ok') {
    return html(400, `<h1>This link has expired</h1><p>Please start connecting DeliveryHub again from the Ring app.</p>`)
  }
  return html(error ? 401 : 200, `
    <h1>Connect your Ring doorbell</h1>
    <p class="mute">Sign in to DeliveryHub to finish connecting your Ring account.</p>
    <div class="card">
      <b>DeliveryHub will:</b>
      <ul>
        <li>Receive doorbell-press and package-motion events from the devices you selected.</li>
        <li>Read the <b>address and tracking number</b> on a package label shown to the doorbell. Never names, never faces. Frames without a label are discarded.</li>
        <li>Keep doorbell photos as proof of delivery for <b>30 days</b>, then delete them automatically.</li>
        <li>Process frames with AWS (Amazon Textract, Amazon Bedrock). Your data is never sold or used for advertising.</li>
      </ul>
      <p class="mute">You can disconnect any time in the Ring app, and delete all your data in DeliveryHub → Settings.</p>
    </div>
    ${error ? `<p class="err">${esc(error)}</p>` : ''}
    <form method="post" action="/ring/link">
      <input type="hidden" name="nonce" value="${esc(nonce)}"><input type="hidden" name="time" value="${esc(time)}">
      <label>Email<input name="email" type="email" required autocomplete="email"></label>
      <label>Home passcode<input name="passcode" type="password" required autocomplete="current-password"></label>
      <label class="row"><input type="checkbox" name="consent" value="yes" required> I agree to the data use above.</label>
      <button type="submit">Sign in and connect</button>
    </form>`)
}

async function linkSubmit(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const f = form(event)
  const nonce = f.get('nonce') ?? ''
  const time = f.get('time') ?? ''
  const email = (f.get('email') ?? '').trim()
  if (linkFreshness(time, Date.now()) !== 'ok') return linkPage(nonce, time)
  // Sign-in: the demo home is protected by a passcode set at deploy time (production: Amazon Cognito).
  if (!safeEqual(f.get('passcode') ?? '', process.env.HOME_PASSCODE ?? '') || !/^\S+@\S+\.\S+$/.test(email)) {
    return linkPage(nonce, time, 'Email or passcode is not correct.')
  }
  if (f.get('consent') !== 'yes') return linkPage(nonce, time, 'Please agree to the data use to continue.')

  const key = process.env.RING_WEBHOOK_SECRET!
  const match = (await listUnclaimed()).find((t) => nonceMatches(nonce, time, t.accountId, key))
  if (!match) return linkPage(nonce, time, 'We could not find this Ring connection. Please start again from the Ring app.')

  const accountIdentifier = maskEmail(email)
  await completeIntegration(match.accessToken, accountIdentifier, nonce)
  await saveRingTokens({ accessToken: match.accessToken, refreshToken: match.refreshToken, expiresAt: match.expiresAt })
  await deleteUnclaimed(match.accountId)

  const devices = await listDeviceIds(match.accessToken).catch(() => [])
  const home = await getHome(process.env.HOME_ID ?? DEMO_HOME_ID)
  if (home) await putHome({ ...home, deviceIds: [...new Set([...home.deviceIds, ...devices.map((d) => d.id)])] })
  await audit('ring_account_linked', { accountIdentifier, devices: devices.length })
  console.log(JSON.stringify({ msg: 'ring_account_linked', devices: devices.length }))

  return html(200, `
    <h1>✓ Connected</h1>
    <p>DeliveryHub is now linked to your Ring account (${devices.length} device${devices.length === 1 ? '' : 's'}).</p>
    <p class="mute">Next time a driver holds a label up to your doorbell, DeliveryHub will check it. No button needed.</p>
    <a class="btn" href="/home">Open DeliveryHub</a>`)
}

const page = (body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>DeliveryHub · Connect Ring</title>
<style>
body{margin:0;background:#0b1220;color:#e6ecf5;font:16px/1.5 Inter,system-ui,-apple-system,sans-serif}
main{max-width:440px;margin:0 auto;padding:32px 20px}
h1{font-size:24px;margin:0 0 8px}.mute{color:#8a9ab5;font-size:14px}.err{color:#ef4444}
.card{border:1px solid #22304a;background:#121a2b;border-radius:16px;padding:14px 16px;margin:16px 0;font-size:14px}
ul{padding-left:18px;margin:8px 0}label{display:block;margin:12px 0;font-size:14px}
input[type=email],input[type=password]{display:block;width:100%;box-sizing:border-box;margin-top:4px;padding:10px 12px;border-radius:12px;border:1px solid #22304a;background:#0b1220;color:#e6ecf5;font-size:16px}
.row{display:flex;gap:8px;align-items:center}
button,.btn{display:inline-block;width:100%;box-sizing:border-box;text-align:center;margin-top:8px;padding:12px;border:0;border-radius:12px;background:#2dd4bf;color:#0b1220;font-weight:700;font-size:16px;text-decoration:none;cursor:pointer}
</style></head><body><main><div style="color:#2dd4bf;font-weight:700;font-size:12px;letter-spacing:.1em">DELIVERYHUB</div>${body}</main></body></html>`
