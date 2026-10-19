// Driver-facing speech with Amazon Polly. Identical phrases are cached in S3 by hash.
import { createHash } from 'node:crypto'
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly'
import { getMedia, putMedia } from './store.js'

const polly = new PollyClient({})
let engine: 'neural' | 'standard' = 'neural'

export async function speak(text: string, voiceId = process.env.VOICE_ID ?? 'Joanna'): Promise<string> {
  const key = `audio/${voiceId}/${createHash('sha256').update(text).digest('hex').slice(0, 24)}.mp3`
  if (await getMedia(key)) return key
  const synth = (Engine: 'neural' | 'standard') =>
    polly.send(new SynthesizeSpeechCommand({ Engine, VoiceId: voiceId as never, OutputFormat: 'mp3', Text: text }))
  // Neural voices aren't offered in every Region (e.g. us-east-2 has only standard), so fall back.
  const res = await synth(engine).catch((e) => {
    if (engine === 'standard' || (e as Error).name !== 'ValidationException') throw e
    engine = 'standard'
    return synth(engine)
  })
  await putMedia(key, await res.AudioStream!.transformToByteArray(), 'audio/mpeg')
  return key
}
