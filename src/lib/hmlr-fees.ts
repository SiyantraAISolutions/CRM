// HM Land Registry Fee Scales
// Scale 1: Transfers for value, charges
// Scale 2: Assents, transmissions, first registrations (AS1, FR1 etc.)

export const SCALE1_BANDS = [
  { max: 80000, fee: 20 },
  { max: 100000, fee: 40 },
  { max: 200000, fee: 100 },
  { max: 500000, fee: 270 },
  { max: 1000000, fee: 540 },
  { max: Infinity, fee: 910 },
]

export const SCALE2_BANDS = [
  { max: 80000, fee: 20 },
  { max: 100000, fee: 40 },
  { max: 200000, fee: 70 },
  { max: 500000, fee: 150 },
  { max: 1000000, fee: 295 },
  { max: Infinity, fee: 500 },
]

export function calculateHMLRFee(propertyValue: number, scale: 1 | 2 = 1): number {
  const bands = scale === 1 ? SCALE1_BANDS : SCALE2_BANDS
  for (const band of bands) {
    if (propertyValue <= band.max) {
      return band.fee
    }
  }
  return 0
}

export function getScaleForFormType(formTypeCode: string): 1 | 2 | null {
  const scale2Forms = ['AS1', 'FR1', 'DJP']
  const scale1Forms = ['TR1', 'TP1', 'AP1', 'SEV', 'RX3', 'ADV1', 'COG1']

  if (scale2Forms.some(f => formTypeCode.includes(f))) return 2
  if (scale1Forms.some(f => formTypeCode.includes(f))) return 1
  return null
}
