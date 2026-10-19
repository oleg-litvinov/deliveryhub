// Ring webhook payload (Ring Partner API v1.1 notifications). Only the fields DoorCheck needs.

export interface RingWebhook {
  meta: { version: string; time: string; request_id: string }
  data: {
    id: string
    type: string // button_press | motion_detected | device_online | ...
    attributes: {
      source: string // device id
      source_type: string
      timestamp: number // epoch ms
      sub_type?: string // motion only: human | package_delivery | vehicle | other_motion | motion | ...
      component_ids?: string[]
    }
    relationships?: { devices?: { links?: { self?: string } } }
  }
}

export function parseWebhook(raw: string): RingWebhook | undefined {
  try {
    const b = JSON.parse(raw)
    if (typeof b?.meta?.request_id !== 'string' || typeof b?.data?.type !== 'string' || typeof b?.data?.attributes?.source !== 'string') return undefined
    b.data.attributes.timestamp = Number(b.data.attributes.timestamp)
    return b as RingWebhook
  } catch {
    return undefined
  }
}

/** A scan runs on a doorbell press (the driver's explicit action) or on person / package motion. */
export function isScanTrigger(w: RingWebhook): boolean {
  if (w.data.type === 'button_press') return true
  if (w.data.type !== 'motion_detected') return false
  const sub = w.data.attributes.sub_type
  return sub === 'package_delivery' || sub === 'human'
}

/** Build a payload exactly like Ring's, for the Doorbell Simulator. */
export function buildWebhook(deviceId: string, type: 'button_press' | 'motion_detected', timestamp: number, subType?: string): RingWebhook {
  return {
    meta: { version: '1.1', time: new Date(timestamp).toISOString(), request_id: crypto.randomUUID() },
    data: {
      id: `${deviceId}_${type === 'button_press' ? 'button_press' : 'motion'}_${timestamp}`,
      type,
      attributes: { source: deviceId, source_type: 'devices', timestamp, ...(subType ? { sub_type: subType } : {}) },
      relationships: { devices: { links: { self: `/v1/devices/${deviceId}` } } },
    },
  }
}
