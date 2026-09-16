import { AtSign, Camera, Link2, Play, ThumbsUp } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { linkFocusRing } from '@/lib/utils'
import type { NftCategory } from '@/types'

/**
 * Desktop-only footer (spec §9, node `70492:696`). The mobile frame
 * (`14:5226`) shows no footer at all — the mobile bottom space is the fixed
 * TabBar instead (ARCHITECTURE.md decision 2).
 */

const HIGHLIGHTS = [
  {
    letter: 'W',
    title: 'Segurança da carteira',
    text: 'Proteja sua carteira e colecione arte digital verificada com confiança.',
  },
  {
    letter: 'C',
    title: 'Criadores em destaque',
    text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.',
  },
  {
    letter: 'D',
    title: 'Alertas de lançamentos',
    text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.',
  },
] as const

// Placeholders provisórios (ARCHITECTURE.md decisão 3) — a extração fina do
// Figma não nomeia glifo exato para os ícones sociais; lucide-react v1 não
// distribui mais ícones de marca (Twitter/Instagram/Facebook/Youtube/
// Linkedin), então cada rede usa um glifo genérico com aria-label da marca.
const SOCIAL_LINKS = [
  { label: 'Twitter', Icon: AtSign },
  { label: 'Instagram', Icon: Camera },
  { label: 'Facebook', Icon: ThumbsUp },
  { label: 'Youtube', Icon: Play },
  { label: 'Linkedin', Icon: Link2 },
] as const

const PROFILE_LINKS = ['Meu perfil', 'Minha coleção', 'Atividade', 'Estúdio do criador', 'Lista de interesse']
const HELP_LINKS = [
  'Central de ajuda',
  'Como comprar NFTs',
  'Carteira e segurança',
  'Política do mercado',
  'Denunciar item',
]
// specs/03-catalogo.md "Header (dívida 1) e footer": atalho de entrada —
// substitui o search inteiro, não preserva filtros anteriores.
const COLLECTION_LINKS: Array<{ label: string; category: NftCategory }> = [
  { label: 'Arte digital', category: 'art' },
  { label: 'Fotografia', category: 'photography' },
  { label: 'Música', category: 'music' },
  { label: 'Arte 3D', category: 'art-3d' },
  { label: 'Utilidade', category: 'utility' },
]

function LinkColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-body-18 font-bold leading-[16px]">{title}</h3>
      <ul className="mt-2 text-body-14 leading-[30px] text-text-secondary">
        {items.map((item) => (
          // Texto simples, sem href falso — colunas "Meu perfil"/"Central de
          // ajuda" continuam inertes (fora do escopo da fase 3).
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function CollectionsLinkColumn() {
  return (
    <div>
      <h3 className="text-body-18 font-bold leading-[16px]">Coleções</h3>
      <ul className="mt-2 text-body-14 leading-[30px] text-text-secondary">
        {COLLECTION_LINKS.map(({ label, category }) => (
          <li key={label}>
            <Link to="/" search={{ category }} className={linkFocusRing}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Footer() {
  return (
    <footer className="hidden lg:block">
      {/* Figma: 4 colunas numa linha só. O medalhão fica ACIMA do texto (flex-col),
          não ao lado — com ele ao lado cada bloco vira ~290px e estoura os 1152px,
          que foi o que motivou o flex-wrap anterior. Empilhado, cabe: 3 blocos de
          ~204 + newsletter de 357 + gaps < 1152. */}
      <div className="min-h-[250px] bg-card p-8">
        <div className="mx-auto flex max-w-content items-stretch gap-x-6 px-6">
          {HIGHLIGHTS.map((h) => (
            <div
              key={h.letter}
              className="flex flex-1 flex-col gap-3 border-l border-primary pl-6 first:border-l-0 first:pl-0"
            >
              <div
                aria-hidden
                className="flex size-[74px] shrink-0 items-center justify-center rounded-full bg-primary text-heading-24 font-bold text-primary-foreground"
              >
                {h.letter}
              </div>
              <h3 className="text-body-17 font-bold leading-[16px] text-foreground">{h.title}</h3>
              <p className="max-w-[204px] text-body-14 leading-[22px] text-text-secondary">{h.text}</p>
            </div>
          ))}

          <div className="w-[357px] shrink-0 border-l border-primary pl-6">
            <h3 className="text-body-18 font-bold leading-[16px]">Antecipe-se ao próximo lançamento</h3>
            <form className="mt-3 flex" onSubmit={(e) => e.preventDefault()}>
              <label htmlFor="newsletter-email" className="sr-only">
                E-mail para a newsletter
              </label>
              <Input
                id="newsletter-email"
                type="email"
                placeholder="digite seu e-mail..."
                className="h-10 min-w-0 flex-1 bg-surface-dark pl-3 drop-shadow-[0_0_10px_rgba(10,6,4,0.45)] placeholder:text-body-14 placeholder:text-text-secondary"
              />
              <Button
                type="submit"
                disabled // nenhum endpoint de newsletter existe no contrato;
                // simular sucesso violaria "nenhum dado fictício fora de src/mocks"
                className="h-10 w-[85px] shrink-0 rounded-l-none rounded-r-[6px] text-body-18 font-bold text-primary-foreground"
              >
                Enviar
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Faixa 2: banda da marca */}
      <div className="min-h-[88px] bg-surface-dark p-8">
        <div className="mx-auto flex max-w-content flex-wrap gap-[92px] px-6 text-body-14 text-foreground">
          <span className="font-bold tracking-[1.4px]">KURIO</span>
          <span className="leading-[22px]">Feito para colecionadores, criadores e cultura</span>
          {/* Placeholders provisórios (ARCHITECTURE.md decisão 3). */}
          <span>contato@kurio.com</span>
          <span>+55 11 5555-0100</span>
        </div>
      </div>

      {/* Faixa 3: colunas de links */}
      <div className="min-h-[236px] bg-card p-8">
        <div className="mx-auto max-w-content px-6">
          <div className="flex flex-wrap gap-[124px]">
            <LinkColumn title="Meu perfil" items={PROFILE_LINKS} />
            <LinkColumn title="Central de ajuda" items={HELP_LINKS} />
            <CollectionsLinkColumn />

            <div className="w-[228px]">
              <h3 className="text-body-18 font-bold leading-[16px]">Redes sociais</h3>
              <div className="mt-2 flex gap-[10px]">
                {SOCIAL_LINKS.map(({ label, Icon }) => (
                  // Sem destino real ainda — span não interativo é melhor a11y
                  // que um href falso (mesmo critério do nav do header).
                  <span key={label} role="img" aria-label={label} className="text-foreground">
                    <Icon aria-hidden className="size-[30px]" />
                  </span>
                ))}
              </div>
              <p className="mt-4 text-body-14 text-text-secondary">Carteiras compatíveis</p>
              <span className="mt-2 inline-flex h-[26px] items-center rounded-lg border border-input bg-surface-dark px-2 text-tiny-9 font-bold tracking-[0.1px] text-text-accent">
                METAMASK  •  WALLETCONNECT  •  COINBASE
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* Faixa 4: copyright. Fundo `ink` (#140d0a), o mesmo da página — é o
          rodapé terminando e devolvendo o fundo do site, não mais uma seção.
          Era um <p> dentro da faixa de links, herdando `bg-card`, o que fundia
          as duas. Cor conferida no Figma (`70492:696`). */}
      <div className="bg-ink">
        <p className="mx-auto max-w-content px-6 py-4 text-center text-body-14 leading-[30px]">
          © 2026 Kurio. Propriedade digital para todos.
        </p>
      </div>
    </footer>
  )
}
