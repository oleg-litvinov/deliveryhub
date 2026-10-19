// Driver-facing speech with Amazon Polly. Identical phrases are cached in S3 by hash.
import { createHash } from 'node:crypto'
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly'
import { getMedia, putMedia } from './store.js'

const polly = new PollyClient({})

export async function speak(text: string, voiceId = process.env.VOICE_ID ?? 'Joanna'): Promise<string> {
  const key = `audio/${voiceId}/${createHash('sha256').update(text).digest('hex').slice(0, 24)}.mp3`
  if (await getMedia(key)) return key
  const res = await polly.send(new SynthesizeSpeechCommand({ Engine: 'neural', VoiceId: voiceId as never, OutputFormat: 'mp3', Text: text }))
  await putMedia(key, await res.AudioStream!.transformToByteArray(), 'audio/mpeg')
  return key
}
