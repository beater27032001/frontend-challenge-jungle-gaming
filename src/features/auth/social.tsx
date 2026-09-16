import { Globe, ThumbsUp } from 'lucide-react'

/**
 * Fase 5 (specs/05-auth.md §3/§7.3/§8.6): honestidade obrigatória — Google e
 * Facebook não têm backend (mesma regra do botão da newsletter da fase 2).
 * `disabled`, nunca simulando sucesso. Ícones genéricos do lucide (`Globe`/
 * `ThumbsUp`), mesmo precedente dos ícones sociais do footer — a marca não
 * tem glifo próprio na lib.
 *
 * Divisor e botões são exportados separados: o cadastro desktop (§7.3) quer
 * o divisor em largura total do modal mas os botões com o inset de 80px —
 * um único wrapper com um padding não serve aos dois blocos.
 */
export function SocialDivider({ className }: { className: string }) {
  return (
    <div className={className}>
      <span aria-hidden className="h-px flex-1 bg-border-strong" />
      Ou continue com
      <span aria-hidden className="h-px flex-1 bg-border-strong" />
    </div>
  )
}

export function SocialButtonsList({ buttonClassName }: { buttonClassName: string }) {
  return (
    <>
      <button
        type="button"
        disabled
        title="Login social ainda não tem backend nesta simulação."
        className={buttonClassName}
      >
        <Globe aria-hidden className="size-5" />
        Continuar com Google
      </button>
      <button
        type="button"
        disabled
        title="Login social ainda não tem backend nesta simulação."
        className={buttonClassName}
      >
        <ThumbsUp aria-hidden className="size-5" />
        Continuar com Facebook
      </button>
    </>
  )
}

export function SocialButtons({
  dividerGap,
  buttonClassName,
}: {
  dividerGap: string
  buttonClassName: string
}) {
  return (
    <>
      <SocialDivider className={`flex items-center ${dividerGap} text-caption-13 text-foreground`} />
      <SocialButtonsList buttonClassName={buttonClassName} />
    </>
  )
}

export function EsqueceuSenha({ className }: { className: string }) {
  return (
    <div className="flex justify-end">
      <button
        type="button"
        disabled
        aria-disabled="true"
        title="Recuperação de senha ainda não tem backend nesta simulação."
        className={className}
      >
        Esqueceu a senha?
      </button>
    </div>
  )
}
