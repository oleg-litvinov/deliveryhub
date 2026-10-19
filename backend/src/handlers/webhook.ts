// POST /ring/webhook — verify Ring's HMAC signature, dedupe, record a "processing" scan,
// hand off to the scan worker asynchronously, and ACK well inside Ring's 5 s limit.
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda'
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { verifySignature } from '../ring/signature.js'
import { isScanTrigger, parseWebhook } from '../ring/webhook.js'
import type { Scan } from '../lib/scan.js'
import { audit, claimEvent, deleteRingTokens, homeIdForDevice, putScan } from '../lib/store.js'

const lambda = new LambdaClient({})
const json = (statusCode: number, body: object): APIGatewayProxyResultV2 => ({ statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const raw = event.isBase64Encoded ? Buffer.from(event.body ?? '', 'base64').toString('utf8') : (event.body ?? '')
  if (!verifySignature(raw, event.headers['x-signature'], process.env.RING_WEBHOOK_SECRET ?? '')) {
    console.warn(JSON.stringify({ msg: 'bad_signature' }))
    return json(401, { error: 'invalid signature' })
  }
  const hook = parseWebhook(raw)
  if (!hook) return json(400, { error: 'invalid payload' })
  if (hook.data.type === 'app_integration_removed') {
    // The user disconnected DeliveryHub in the Ring app: drop their Ring tokens immediately.
    await deleteRingTokens()
    await audit('ring_integration_removed', { requestId: hook.meta.request_id })
    return json(200, { status: 'tokens_deleted' })
  }
  if (!isScanTrigger(hook)) return json(200, { status: 'ignored', type: hook.data.type })
  if (!(await claimEvent(hook.meta.request_id))) return json(200, { status: 'duplicate' })

  const deviceId = hook.data.attributes.source
  const homeId = await homeIdForDevice(deviceId)
  if (!homeId) return json(200, { status: 'unknown_device' })

  const scan: Scan = {
    scanId: crypto.randomUUID(),
    homeId,
    deviceId,
    trigger: hook.data.type as Scan['trigger'],
    eventTimestamp: hook.data.attributes.timestamp,
    createdAt: Date.now(),
    simulated: deviceId.startsWith('sim-'),
    status: 'processing',
  }
  await putScan(scan)
  await lambda.send(new InvokeCommand({ FunctionName: process.env.WORKER_FUNCTION, InvocationType: 'Event', Payload: JSON.stringify(scan) }))
  console.log(JSON.stringify({ msg: 'scan_queued', scanId: scan.scanId, type: hook.data.type, sub_type: hook.data.attributes.sub_type, simulated: scan.simulated }))
  return json(200, { status: 'accepted', scanId: scan.scanId })
}
