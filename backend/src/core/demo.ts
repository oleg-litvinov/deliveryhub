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
    p('books', 'TBA304918275000', 'Kids books', 'Amazon', 'Amazon', 'Please ring the bell, someone is home.'),
  ]
}

/** Sample labels for the Doorbell Simulator (rendered in the browser). */
export const SAMPLE_LABELS = [
  { id: 'meds', title: 'Medication (expected, USPS)', tracking: '9400111899223344556677', barcode: '420627049400111899223344556677', carrier: 'USPS', to: ['123 MAPLE ST', 'SPRINGFIELD IL 62704'] },
  { id: 'shoes', title: 'Shoes (expected, UPS)', tracking: '1Z999AA10123456784', barcode: '1Z999AA10123456784', carrier: 'UPS', to: ['123 MAPLE STREET', 'SPRINGFIELD, IL 62704'] },
  { id: 'neighbor', title: "Neighbor's package (wrong house)", tracking: '1Z999AA10198765432', barcode: '1Z999AA10198765432', carrier: 'UPS', to: ['42 OAK ST', 'SPRINGFIELD, IL 62704'] },
  { id: 'surprise', title: 'Surprise gift (not expected)', tracking: '9400111899229988776655', barcode: '420627049400111899229988776655', carrier: 'USPS', to: ['123 MAPLE ST', 'SPRINGFIELD IL 62704'] },
]
