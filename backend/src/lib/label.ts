// Label reading: Amazon Bedrock vision first, Amazon Textract OCR as fallback.
// Both return only the ship-to address and tracking number. The recipient name is never requested or stored.
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime'
import { DetectDocumentTextCommand, TextractClient } from '@aws-sdk/client-textract'
import { parseAddressFromLines } from '../core/address.js'
import { guessCarrier } from '../core/tracking.js'
import type { LabelRead } from '../core/types.js'

const bedrock = new BedrockRuntimeClient({})
const textract = new TextractClient({})

const PROMPT = `You are reading a shipping label held up to a doorbell camera.
Return ONLY a JSON object, no prose:
{"ship_to":{"line1":"street number, street name and unit","city":"","state":"two-letter","zip":""},
 "tracking_number":"", "carrier":"UPS|USPS|FedEx|Amazon|DHL|other", "confidence":0.0}
Rules: use the SHIP TO / recipient address, not the return address. Do NOT include any person or company name.
Use null for fields you cannot read. confidence is 0..1 for the ship_to address. If there is no label, return {"confidence":0}.`

export async function readWithBedrock(image: Uint8Array, format: 'jpeg' | 'png'): Promise<LabelRead> {
  const res = await bedrock.send(
    new ConverseCommand({
      modelId: process.env.MODEL_ID ?? 'amazon.nova-lite-v1:0',
      messages: [{ role: 'user', content: [{ image: { format, source: { bytes: image } } }, { text: PROMPT }] }],
      inferenceConfig: { maxTokens: 300, temperature: 0 },
    }),
  )
  const text = res.output?.message?.content?.map((c) => c.text ?? '').join('') ?? ''
  const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
  const s = json.ship_to ?? {}
  return {
    source: 'bedrock',
    trackingNumber: json.tracking_number || undefined,
    carrier: json.carrier || undefined,
    address: s.line1 ? { line1: String(s.line1), city: s.city ?? undefined, state: s.state ?? undefined, zip: s.zip ?? undefined } : undefined,
    confidence: Number(json.confidence) || 0,
  }
}

const TRACKING_PATTERNS = [/\b1Z[0-9A-Z]{16}\b/, /\bTBA\d{9,}\b/, /\b9[2-5]\d{2}(?:\s?\d{4}){4}\s?\d{2}\b/, /\b\d{4}\s?\d{4}\s?\d{4}\b/]

export async function readWithTextract(image: Uint8Array): Promise<LabelRead> {
  const res = await textract.send(new DetectDocumentTextCommand({ Document: { Bytes: image } }))
  const lines = (res.Blocks ?? []).filter((b) => b.BlockType === 'LINE' && b.Text)
  const texts = lines.map((b) => b.Text!)
  const address = parseAddressFromLines(texts)
  let trackingNumber: string | undefined
  for (const re of TRACKING_PATTERNS) {
    const hit = texts.join('\n').toUpperCase().match(re)
    if (hit) { trackingNumber = hit[0].replace(/\s/g, ''); break }
  }
  const avg = lines.reduce((s, b) => s + (b.Confidence ?? 0), 0) / Math.max(lines.length, 1) / 100
  return {
    source: 'textract',
    trackingNumber,
    carrier: trackingNumber ? guessCarrier(trackingNumber) : undefined,
    address,
    confidence: address ? Math.min(0.95, avg) : 0,
  }
}

/** Primary reader with graceful fallback, so a Bedrock outage or quota block never stops a delivery. */
export async function readLabel(image: Uint8Array, format: 'jpeg' | 'png'): Promise<LabelRead> {
  const mode = process.env.LABEL_MODE ?? 'bedrock'
  const errors: string[] = []
  if (mode === 'bedrock') {
    try {
      return await readWithBedrock(image, format)
    } catch (e) {
      errors.push(`bedrock: ${(e as Error).name}: ${(e as Error).message}`)
      console.warn(JSON.stringify({ msg: 'bedrock_failed_fallback_textract', error: errors[0] }))
    }
  }
  try {
    return { ...(await readWithTextract(image)), error: errors[0] }
  } catch (e) {
    errors.push(`textract: ${(e as Error).name}: ${(e as Error).message}`)
    console.warn(JSON.stringify({ msg: 'textract_failed', error: errors.at(-1) }))
  }
  return { source: 'none', confidence: 0, error: errors.join(' | ') }
}
