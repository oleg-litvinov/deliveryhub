// Seed data for the judge-tryable demo home. Addresses and tracking numbers are fictional.
import type { Home, Package } from './types.js'

export const DEMO_HOME_ID = 'demo'
export const SIM_DEVICE_ID = 'sim-front-door'

export function demoHome(extraDeviceIds: string[] = []): Home {
  return {
    homeId: DEMO_HOME_ID,
    name: 'The Rivera home',
    address: { line1: '123 Maple Street', city: 'Springfield', state: 'IL', zip: '62704' },
    defaultInstruction: 'Please leave packages behind the planter, out of sight from the street.',
    deviceIds: [SIM_DEVICE_ID, ...extraDeviceIds],
  }
}

export function demoPackages(now: number): Package[] {
  const p = (packageId: string, trackingNumber: string, nickname: string, carrier: string, sender: string, instruction?: string): Package => ({
    packageId, homeId: DEMO_HOME_ID, trackingNumber, nickname, carrier, sender, instruction, status: 'expected', createdAt: now,
  })
  return [
    p('meds', '9400111899223344556677', "Mom's medication", 'USPS', 'CVS Pharmacy', 'This is medication. Please put it in the cooler box by the door.'),
    p('shoes', '1Z999AA10123456784', 'Running shoes', 'UPS', 'Zappos'),
    p('books', 'TBA304918275000', 'Kids books', 'Amazon', 'Amazon', 'These are books. Please keep them dry.'),
  ]
}

/**
 * Sample labels for the Doorbell Simulator (rendered in the browser).
 * kind = what the label is *meant* to demonstrate; the simulator also checks live package status.
 */
export const SAMPLE_LABELS = [
  { id: 'meds', kind: 'expected', title: 'Medication (expected, USPS)', tracking: '9400111899223344556677', barcode: '420627049400111899223344556677', symbology: 'code128', carrier: 'USPS', to: ['123 MAPLE ST', 'SPRINGFIELD IL 62704'] },
  { id: 'shoes', kind: 'expected', title: 'Running shoes (expected, UPS)', tracking: '1Z999AA10123456784', barcode: '1Z999AA10123456784', symbology: 'code128', carrier: 'UPS', to: ['123 MAPLE STREET', 'SPRINGFIELD, IL 62704'] },
  { id: 'books', kind: 'expected', title: 'Kids books (expected, Amazon)', tracking: 'TBA304918275000', barcode: 'TBA304918275000', symbology: 'qrcode', carrier: 'Amazon', to: ['123 MAPLE ST', 'SPRINGFIELD IL 62704'] },
  { id: 'neighbor', kind: 'wrong_house', title: "Neighbor's package (wrong house)", tracking: '1Z999AA10198765432', barcode: '1Z999AA10198765432', symbology: 'code128', carrier: 'UPS', to: ['42 OAK ST', 'SPRINGFIELD, IL 62704'] },
  { id: 'surprise', kind: 'unexpected', title: 'Surprise gift (not expected)', tracking: '9400111899229988776655', barcode: '420627049400111899229988776655', symbology: 'code128', carrier: 'USPS', to: ['123 MAPLE ST', 'SPRINGFIELD IL 62704'] },
] as const
