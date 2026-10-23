// Doorbell Simulator imaging: render a 4x6 shipping label, "hold it up" to a virtual doorbell,
// and degrade the frame like a real one (wide-angle barrel distortion, downscale, JPEG, watermark).
import bwipjs from 'bwip-js/browser'
import type { SampleLabel } from './api'

export const FRAME_W = 1920
export const FRAME_H = 1080

const RECIPIENT: Record<string, string> = { neighbor: 'M. CHEN' }
const SERVICE: Record<string, string> = { UPS: 'UPS GROUND', USPS: 'USPS PRIORITY MAIL', Amazon: 'AMAZON SHIPPING', FedEx: 'FEDEX HOME DELIVERY' }

export function renderLabel(s: SampleLabel): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = 600
  c.height = 900
  const g = c.getContext('2d')!
  g.fillStyle = '#fff'
  g.fillRect(0, 0, 600, 900)
  g.strokeStyle = '#111'
  g.lineWidth = 4
  g.strokeRect(6, 6, 588, 888)
  g.fillStyle = '#111'

  g.font = '800 44px Inter, Arial, sans-serif'
  g.fillText(SERVICE[s.carrier] ?? s.carrier.toUpperCase(), 28, 70)
  g.fillRect(6, 92, 588, 4)

  g.font = '500 20px Inter, Arial, sans-serif'
  ;['ACME FULFILLMENT', '1 WAREHOUSE RD', 'RENO NV 89501'].forEach((t, i) => g.fillText(t, 28, 130 + i * 26))
  g.fillRect(6, 220, 588, 2)

  g.font = '700 22px Inter, Arial, sans-serif'
  g.fillText('SHIP TO:', 28, 262)
  g.font = '700 34px Inter, Arial, sans-serif'
  g.fillText(RECIPIENT[s.id] ?? 'J. RIVERA', 28, 306)
  g.font = '800 40px Inter, Arial, sans-serif'
  s.to.forEach((t, i) => g.fillText(t, 28, 358 + i * 50))
  g.fillRect(6, 470, 588, 4)

  // Render at the largest whole-pixel module size that fits, so bars/modules are never resampled.
  const bc = document.createElement('canvas')
  g.imageSmoothingEnabled = false
  if (s.symbology === 'qrcode') {
    // Amazon-style labels carry a large 2D code; it survives distance and blur better than 1D bars.
    const opts = { bcid: 'qrcode', text: s.barcode, backgroundcolor: 'FFFFFF', paddingwidth: 2, paddingheight: 2 }
    bwipjs.toCanvas(bc, { ...opts, scale: 1 })
    bwipjs.toCanvas(bc, { ...opts, scale: Math.max(1, Math.floor(250 / bc.width)) })
    g.drawImage(bc, Math.round((600 - bc.width) / 2), 495, bc.width, bc.height)
  } else {
    const opts = { bcid: 'code128', text: s.barcode, height: 22, includetext: false, backgroundcolor: 'FFFFFF' }
    bwipjs.toCanvas(bc, { ...opts, scale: 1 })
    bwipjs.toCanvas(bc, { ...opts, scale: Math.max(1, Math.floor(560 / bc.width)) })
    g.drawImage(bc, Math.round((600 - bc.width) / 2), 510, bc.width, 230)
  }

  g.font = '700 26px "Courier New", monospace'
  const pretty = s.tracking.replace(/(.{4})/g, '$1 ').trim()
  g.fillText(`TRACKING #: ${pretty}`, 28, 790, 544)
  g.font = '500 18px Inter, Arial, sans-serif'
  g.fillText('Doorbell Simulator sample label · fictional address', 28, 860)
  return c
}

function drawPorch(g: CanvasRenderingContext2D) {
  const sky = g.createLinearGradient(0, 0, 0, FRAME_H)
  sky.addColorStop(0, '#3a4256')
  sky.addColorStop(1, '#1d2230')
  g.fillStyle = sky
  g.fillRect(0, 0, FRAME_W, FRAME_H)
  g.fillStyle = '#5b4636' // door
  g.fillRect(80, 120, 520, 960)
  g.fillStyle = '#2b2f3a' // driver's jacket
  g.beginPath()
  g.ellipse(FRAME_W / 2, FRAME_H + 120, 620, 420, 0, 0, Math.PI * 2)
  g.fill()
}

/** Barrel distortion like a wide-angle doorbell lens (k > 0 bulges the center). */
function barrel(src: HTMLCanvasElement, k = 0.12): HTMLCanvasElement {
  const w = src.width, h = src.height
  const sd = src.getContext('2d')!.getImageData(0, 0, w, h).data
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const og = out.getContext('2d')!
  const img = og.createImageData(w, h)
  const d = img.data
  const cx = w / 2, cy = h / 2, norm = Math.hypot(cx, cy)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x - cx) / norm, ny = (y - cy) / norm
      const f = 1 + k * (nx * nx + ny * ny)
      const sx = cx + nx * f * norm * 0.92, sy = cy + ny * f * norm * 0.92
      const di = (y * w + x) * 4
      d[di + 3] = 255
      const x0 = Math.floor(sx), y0 = Math.floor(sy)
      if (x0 < 0 || y0 < 0 || x0 >= w - 1 || y0 >= h - 1) continue
      // Bilinear sampling, like a real lens + sensor (no stair-stepping on barcode bars).
      const fx = sx - x0, fy = sy - y0
      const i00 = (y0 * w + x0) * 4, i10 = i00 + 4, i01 = i00 + w * 4, i11 = i01 + 4
      for (let ch = 0; ch < 3; ch++) {
        d[di + ch] = (sd[i00 + ch] * (1 - fx) + sd[i10 + ch] * fx) * (1 - fy) + (sd[i01 + ch] * (1 - fx) + sd[i11 + ch] * fx) * fy
      }
    }
  }
  og.putImageData(img, 0, 0)
  return out
}

function watermark(g: CanvasRenderingContext2D, deviceId: string, ts: number) {
  g.font = '600 26px Inter, Arial, sans-serif'
  g.fillStyle = 'rgba(255,255,255,.85)'
  g.fillText('SIMULATED DOORBELL', 32, 52)
  const right = `${deviceId} · DeliveryHub · ${new Date(ts).toISOString().replace('T', ' ').slice(0, 19)}`
  g.textAlign = 'right'
  g.fillText(right, FRAME_W - 32, 52)
  g.textAlign = 'left'
}

export interface FrameOptions { distance: number; tilt: number; blur: number; deviceId: string; timestamp: number }

/** Compose a doorbell frame from a sample label (synthetic scene) or a real photo/webcam frame. */
export function composeFrame(source: { label?: SampleLabel; image?: CanvasImageSource & { width: number; height: number } }, o: FrameOptions): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = FRAME_W
  c.height = FRAME_H
  const g = c.getContext('2d')!
  if (source.label) {
    drawPorch(g)
    const label = renderLabel(source.label)
    const h = FRAME_H * o.distance // distance 0.5..0.95 = how close the driver holds it
    const w = (h * label.width) / label.height
    g.save()
    g.translate(FRAME_W / 2 + 60, FRAME_H / 2 + 20)
    g.rotate((o.tilt * Math.PI) / 180)
    g.filter = o.blur ? `blur(${o.blur}px)` : 'none'
    g.shadowColor = 'rgba(0,0,0,.45)'
    g.shadowBlur = 30
    g.drawImage(label, -w / 2, -h / 2, w, h)
    g.restore()
  } else if (source.image) {
    const s = Math.max(FRAME_W / source.image.width, FRAME_H / source.image.height)
    const w = source.image.width * s, h = source.image.height * s
    g.drawImage(source.image, (FRAME_W - w) / 2, (FRAME_H - h) / 2, w, h)
  }
  const out = source.label ? barrel(c) : c
  watermark(out.getContext('2d')!, o.deviceId, o.timestamp)
  return out
}

export const toJpeg = (c: HTMLCanvasElement, q = 0.85) =>
  new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', q))

/**
 * Realistic sample: a doorbell-style photo (already wide-angle) of a driver holding the parcel.
 * Generated photos can't contain a *real* barcode, so we draw a scannable one over the label's barcode area,
 * encoding the same tracking number printed under it, and cover the photo's fake camera timestamp.
 */
export function composePhotoFrame(photo: HTMLImageElement, label: SampleLabel, o: { deviceId: string; timestamp: number }): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = FRAME_W
  c.height = FRAME_H
  const g = c.getContext('2d')!
  const k = Math.max(FRAME_W / photo.naturalWidth, FRAME_H / photo.naturalHeight)
  const dx = (FRAME_W - photo.naturalWidth * k) / 2
  const dy = (FRAME_H - photo.naturalHeight * k) / 2
  g.drawImage(photo, dx, dy, photo.naturalWidth * k, photo.naturalHeight * k)

  if (label.photoBarcodeBox) {
    const [bx, by, bw, bh] = label.photoBarcodeBox
    const x = dx + bx * k, y = dy + by * k, w = bw * k, h = bh * k
    // Match the label's paper colour (sampled just above the barcode area) so the patch blends in.
    const px = g.getImageData(Math.round(x + w / 2 - 15), Math.round(y - 14), 30, 8).data
    const avg = [0, 1, 2].map((ch) => { let t = 0; for (let i = ch; i < px.length; i += 4) t += px[i]; return Math.round(t / (px.length / 4)) })
    const paper = avg.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()
    g.fillStyle = `#${paper}`
    g.fillRect(x, y, w, h)
    const bc = document.createElement('canvas')
    const opts = { bcid: label.symbology === 'qrcode' ? 'qrcode' : 'code128', text: label.barcode, height: 12, includetext: false, backgroundcolor: paper }
    bwipjs.toCanvas(bc, { ...opts, scale: 1 })
    const scale = Math.max(1, Math.floor(Math.min((w * 0.94) / bc.width, label.symbology === 'qrcode' ? (h * 0.94) / bc.height : Infinity)))
    bwipjs.toCanvas(bc, { ...opts, scale })
    g.imageSmoothingEnabled = false
    const bh2 = label.symbology === 'qrcode' ? bc.height : h * 0.86
    g.drawImage(bc, Math.round(x + (w - bc.width) / 2), Math.round(y + (h - bh2) / 2), bc.width, bh2)
  }
  // Cover the generated image's own camera timestamp, then add ours.
  g.fillStyle = 'rgba(0,0,0,.55)'
  g.fillRect(FRAME_W - 760, 14, 746, 52)
  watermark(g, o.deviceId, o.timestamp)
  return c
}
