import Big from 'big.js'
import type { EthAmount } from '@/types/common'

/**
 * All ETH arithmetic goes through big.js. Never `number` for money —
 * float addition (0.1 + 0.2) corrupts price. Quantities stay integers.
 */

export function eth(v: string): Big {
  return new Big(v)
}

/** 6 decimal places, half-up, no trailing zeros (Big#toString does not pad). */
export function roundEth(b: Big): EthAmount {
  return b.round(6, Big.roundHalfUp).toString()
}

export function mulQty(price: string, qty: number): EthAmount {
  return roundEth(eth(price).times(qty))
}
