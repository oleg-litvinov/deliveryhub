// Persistence: one DynamoDB table (pk/sk) + one S3 bucket for snapshots, audio and simulator frames.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { BatchWriteCommand, DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { Box, Home, Package } from '../core/types.js'
import type { Scan } from './scan.js'

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } })
const s3 = new S3Client({})
const TABLE = () => process.env.TABLE_NAME!
const BUCKET = () => process.env.MEDIA_BUCKET!

const get = async <T>(pk: string, sk: string) =>
  (await ddb.send(new GetCommand({ TableName: TABLE(), Key: { pk, sk } }))).Item as (T & { pk: string; sk: string }) | undefined
const put = (pk: string, sk: string, item: object) => ddb.send(new PutCommand({ TableName: TABLE(), Item: { pk, sk, ...item } }))
const query = async <T>(pk: string, prefix: string, limit?: number, newestFirst = false) =>
  ((
    await ddb.send(
      new QueryCommand({
        TableName: TABLE(),
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :p)',
        ExpressionAttributeValues: { ':pk': pk, ':p': prefix },
        ScanIndexForward: !newestFirst,
        Limit: limit,
      }),
    )
  ).Items ?? []) as T[]
const strip = <T extends object>(o: T & { pk?: string; sk?: string }): T => {
  const { pk, sk, ...rest } = o
  return rest as T
}

// ---- homes & devices
export const getHome = async (homeId: string) => { const h = await get<Home>(`HOME#${homeId}`, 'META'); return h && strip(h) }
export async function putHome(home: Home) {
  await put(`HOME#${home.homeId}`, 'META', home)
  await Promise.all(home.deviceIds.map((d) => put(`DEVICE#${d}`, 'MAP', { homeId: home.homeId })))
}
export const homeIdForDevice = async (deviceId: string) => (await get<{ homeId: string }>(`DEVICE#${deviceId}`, 'MAP'))?.homeId

// ---- packages
export const listPackages = async (homeId: string) => (await query<Package>(`HOME#${homeId}`, 'PKG#')).map(strip)
export const putPackage = (p: Package) => put(`HOME#${p.homeId}`, `PKG#${p.packageId}`, p)
export const deletePackage = (homeId: string, id: string) => ddb.send(new DeleteCommand({ TableName: TABLE(), Key: { pk: `HOME#${homeId}`, sk: `PKG#${id}` } }))
export async function markPackage(homeId: string, packageId: string, status: Package['status'], fields: Partial<Package> = {}) {
  const sets = Object.entries({ status, ...fields })
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE(),
      Key: { pk: `HOME#${homeId}`, sk: `PKG#${packageId}` },
      ConditionExpression: 'attribute_exists(pk)',
      UpdateExpression: 'SET ' + sets.map((_, i) => `#k${i} = :v${i}`).join(', '),
      ExpressionAttributeNames: Object.fromEntries(sets.map(([k], i) => [`#k${i}`, k])),
      ExpressionAttributeValues: Object.fromEntries(sets.map(([, v], i) => [`:v${i}`, v])),
    }),
  )
}

// ---- scans (sk sorts by time)
export const scanSk = (s: Pick<Scan, 'createdAt' | 'scanId'>) => `SCAN#${String(s.createdAt).padStart(15, '0')}#${s.scanId}`
export const putScan = (s: Scan) => put(`HOME#${s.homeId}`, scanSk(s), s)
export const listScans = async (homeId: string, limit = 30) => (await query<Scan>(`HOME#${homeId}`, 'SCAN#', limit, true)).map(strip)
export async function deleteScans(homeId: string) {
  const items = await query<{ pk: string; sk: string }>(`HOME#${homeId}`, 'SCAN#')
  for (let i = 0; i < items.length; i += 25) {
    const batch = items.slice(i, i + 25).map(({ pk, sk }) => ({ DeleteRequest: { Key: { pk, sk } } }))
    await ddb.send(new BatchWriteCommand({ RequestItems: { [TABLE()]: batch } }))
  }
}

// ---- delivery box
export const getBox = async (homeId: string) => { const b = await get<Box>(`HOME#${homeId}`, 'BOX'); return b && strip(b) }
export const putBox = (b: Box) => put(`HOME#${b.homeId}`, 'BOX', b)

// ---- webhook idempotency (Ring retries; meta.request_id dedupes)
export async function claimEvent(requestId: string): Promise<boolean> {
  try {
    await ddb.send(
      new PutCommand({
        TableName: TABLE(),
        Item: { pk: `EVENT#${requestId}`, sk: 'EVENT', ttl: Math.floor(Date.now() / 1000) + 86_400 },
        ConditionExpression: 'attribute_not_exists(pk)',
      }),
    )
    return true
  } catch (e) {
    if ((e as Error).name === 'ConditionalCheckFailedException') return false
    throw e
  }
}

// ---- Ring OAuth tokens (refresh token may rotate, so it lives in the table, encrypted at rest)
export interface RingTokens { accessToken: string; refreshToken: string; expiresAt: number }
export const getRingTokens = async () => { const t = await get<RingTokens>('RING', 'TOKENS'); return t && strip(t) }
export const saveRingTokens = (t: RingTokens) => put('RING', 'TOKENS', t)

// ---- S3 media
export const putMedia = (key: string, body: Uint8Array, contentType: string) =>
  s3.send(new PutObjectCommand({ Bucket: BUCKET(), Key: key, Body: body, ContentType: contentType }))
export async function getMedia(key: string): Promise<Uint8Array | undefined> {
  try {
    const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET(), Key: key }))
    return await r.Body!.transformToByteArray()
  } catch (e) {
    if ((e as Error).name === 'NoSuchKey') return undefined
    throw e
  }
}
export const mediaGetUrl = (key: string) => getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET(), Key: key }), { expiresIn: 3600 })
export const mediaPutUrl = (key: string, contentType: string) =>
  getSignedUrl(s3, new PutObjectCommand({ Bucket: BUCKET(), Key: key, ContentType: contentType }), { expiresIn: 300 })
