import { ArrowRight } from 'lucide-react'
import { cn, linkFocusRing } from '@/lib/utils'

/**
 * Two distinct compositions (specs/03-catalogo.md §1 + resolução OQ5), never
 * one hero that adapts (ARCHITECTURE.md decisão 1). Each is `hidden`/
 * `lg:hidden` at the call site in `routes/index.tsx` so only one `<h1>` is
 * ever in the accessibility tree per viewport.
 */

const HERO_COPY =
  'Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.'

// 3 pontos decorativos: não existem slides 2/3 no arquivo, um carrossel de um
// slide só seria pior que nenhum (resolução OQ6, ARCHITECTURE.md decisão 7).
function HeroDots({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('flex items-center gap-2', className)}>
      <span className="size-2 rounded-full bg-primary" />
      <span className="size-2 rounded-full bg-border-soft" />
      <span className="size-2 rounded-full bg-border-soft" />
    </div>
  )
}

export function HeroDesktop() {
  return (
    <section className="flex h-[450px] w-full items-center justify-between gap-6 pl-[40px]">
      {/* Estrutura de gaps aninhada do Figma (70342:2672), não um gap chapado:
          items-end alinha os pontos à direita da coluna; 8 entre sobretítulo e
          título, 4 até o parágrafo, 32 até o CTA, 44 até os pontos. */}
      <div className="flex w-[600px] max-w-[600px] flex-col items-end gap-[44px]">
        <div className="flex w-full flex-col gap-[32px]">
          <div className="flex w-full flex-col gap-[4px]">
            <div className="flex w-full flex-col gap-[8px]">
              <p className="text-body-14 leading-[16px] font-medium tracking-[1.4px] text-foreground">
                Bem-vindo à Kurio
              </p>
              <h1 className="text-display-43 leading-[70px] font-bold text-foreground">
                <span className="block">SEJA DONO DO FUTURO</span>
                <span className="block">DA ARTE DIGITAL</span>
              </h1>
            </div>
            <p className="max-w-[557px] text-body-14 leading-[24px] text-text-secondary">
              {HERO_COPY}
            </p>
          </div>
          <a
            href="#catalogo"
            className={cn(
              linkFocusRing,
              'inline-flex h-10 w-[140px] items-center justify-center rounded-[6px] bg-primary pl-[28px] pr-[36px] text-body-16 leading-[20px] font-bold text-primary-foreground',
            )}
          >
            EXPLORAR
          </a>
        </div>
        <HeroDots />
      </div>
      <img
        src="/nft/ape-01.webp"
        alt="Arte digital em destaque no catálogo Kurio"
        className="h-[450px] w-[450px] shrink-0 rounded-[24px] object-cover"
      />
    </section>
  )
}

export function HeroMobile() {
  return (
    <section className="flex w-full flex-col gap-4">
      <div className="relative w-full overflow-hidden rounded-[12px] bg-card p-4">
        {/* ponytail: aproximação CSS do SVG exportado (fundo com gradiente +
            2 círculos) — pedir extração do SVG se a baseline visual da fase
            10 acusar (ARCHITECTURE.md, resolução OQ5). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,color-mix(in_oklab,var(--color-primary)_35%,transparent),transparent_60%),radial-gradient(circle_at_95%_75%,color-mix(in_oklab,var(--color-primary)_25%,transparent),transparent_55%)]"
        />
        <div className="relative z-10 flex max-w-[190px] flex-col gap-2">
          <p className="text-caption-12 leading-[16px] font-medium text-foreground">Bem-vindo à Kurio</p>
          <h1 className="max-w-[190px] text-body-18 leading-[29px] font-bold text-foreground">
            <span className="block">SEJA DONO DA</span>
            <span className="block">CULTURA DIGITAL</span>
          </h1>
          <p className="text-caption-12 leading-[18px] text-text-secondary">
            Descubra NFTs selecionados de criadores do mundo todo.
          </p>
          <a
            href="#catalogo"
            className={cn(
              linkFocusRing,
              'inline-flex w-fit items-center gap-2 text-caption-12 leading-[14px] font-bold text-text-accent',
            )}
          >
            EXPLORAR
            <ArrowRight aria-hidden className="size-4" />
          </a>
        </div>
        {/* ponytail: offset entre as duas artes transcrito (ml-[14px]
            mt-[88px]); a posição do grupo dentro do card não foi transcrita
            — ancorado no canto inferior direito, provisório. */}
        <div aria-hidden className="pointer-events-none absolute -right-3 -bottom-3">
          <img src="/nft/ape-01.webp" alt="" className="h-[138px] w-[138px] rounded-[16px] object-cover" />
          <img
            src="/nft/ape-02.webp"
            alt=""
            className="absolute mt-[88px] ml-[14px] h-[58px] w-[58px] rounded-[16px] object-cover"
          />
        </div>
      </div>
      <div aria-hidden className="flex items-center justify-center gap-1.5">
        <span className="h-[7px] w-[7px] rounded-full bg-primary" />
        <span className="h-[7px] w-[7px] rounded-full bg-border-soft" />
        <span className="h-[7px] w-[7px] rounded-full bg-border-soft" />
      </div>
    </section>
  )
}
