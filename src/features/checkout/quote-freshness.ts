import type { Cart, Quote } from '@/types'

/**
 * Gate do passo 4 do cenário obrigatório (§7): "o checkout impede a confirmação
 * com uma cotação desatualizada".
 *
 * A cotação carrega `nftVersion` por item (fase 1, `types/quote.ts`); o
 * carrinho relido carrega a versão atual do catálogo. Qualquer divergência —
 * versão diferente, preço diferente, item que saiu do carrinho — significa que
 * um `nft.updated` passou depois da cotação: confirmar seria comprar com preço
 * velho. Comparar versão é suficiente e não depende de aritmética de decimal.
 *
 * A tela de pagamento é a fase 7; aqui fica a regra, pura e testável, para ela
 * consumir junto do 409 `quote_outdated` que o servidor já devolve.
 */
export function staleQuoteItems(quote: Quote, cart: Cart | undefined): string[] {
  if (!cart) return []
  const stale: string[] = []
  for (const item of quote.items) {
    const line = cart.items.find((i) => i.nftId === item.nftId && i.editionId === item.editionId)
    if (!line || line.nftVersion !== item.nftVersion) stale.push(item.nftId)
  }
  return stale
}

export function isQuoteStale(quote: Quote, cart: Cart | undefined): boolean {
  return staleQuoteItems(quote, cart).length > 0
}
