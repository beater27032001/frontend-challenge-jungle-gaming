import { ArrowRight } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { cn, linkFocusRing } from '@/lib/utils'

/**
 * Cards promocionais + "Diário da Cunhagem", as duas seções do fim da home
 * (`specs/03-catalogo.md` §7).
 *
 * A fase 3 as omitiu de propósito (ARCHITECTURE.md, decisão 13): o desafio
 * exclui páginas editoriais da entrega, e bloco estático com link morto
 * aparenta navegação que não existe. O usuário reviu a decisão — as seções
 * fazem parte do desenho e a home sem elas termina abruptamente na paginação.
 *
 * O compromisso que mantém a regra de pé: **nada aqui finge navegar**.
 * "Explorar" leva ao catálogo, que é destino real. "Ler mais" não é link — é
 * texto com `aria-disabled`, mesmo tratamento de "Criadores" e "Aprenda" no
 * header, porque as matérias não existem.
 *
 * ⚠️ Medidas derivadas da captura do Figma, não extraídas: a cota do MCP
 * estourou. Proporções e escala tipográfica seguem a régua do catálogo
 * (gap 56, raio 14, arte quadrada). Recalibrar com `get_design_context`
 * quando a cota voltar — está em "Dívidas" no ARCHITECTURE.md.
 */

const PROMOS = [
  {
    title: 'Lançamentos gênesis\nde edição limitada',
    body: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
    image: '/nft/ape-01.webp',
  },
  {
    title: 'Arte digital selecionada\ne muito mais',
    body: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.',
    image: '/nft/ape-02.webp',
  },
]

const POSTS = [
  {
    date: '12 de setembro',
    read: 'Leitura de 6 min',
    title: 'Como funciona a propriedade de NFTs',
    body: 'Aprenda a colecionar, negociar e verificar ativos digitais.',
    image: '/nft/ape-02.webp',
  },
  {
    date: '13 de setembro',
    read: 'Leitura de 2 min',
    title: '10 artistas digitais para acompanhar',
    body: 'Conheça criadores que moldam a cultura digital.',
    image: '/nft/ape-01.webp',
  },
  {
    date: '15 de setembro',
    read: 'Leitura de 3 min',
    title: 'Raridade, atributos e procedência',
    body: 'Entenda raridade, procedência, direitos autorais e utilidade.',
    image: '/nft/ape-03.webp',
  },
  {
    date: '15 de setembro',
    read: 'Leitura de 2 min',
    title: 'Como proteger sua carteira',
    body: 'Proteja sua carteira, seus ativos e sua identidade.',
    image: '/nft/ape-04.webp',
  },
]

export function HomeEditorial() {
  return (
    <>
      <section aria-label="Destaques" className="grid gap-6 lg:grid-cols-2">
        {PROMOS.map((promo) => (
          <div
            key={promo.title}
            className="flex overflow-hidden rounded-[14px] bg-card"
          >
            {/* width/height: sem as dimensões o navegador não reserva espaço e
                a imagem empurra o texto ao carregar (CLS). Sem `loading=lazy`:
                eu o adicionei por iniciativa própria e ele tornou a baseline
                visual não determinística — imagem preguiçosa nem sempre
                termina de carregar antes do print. O achado do Lighthouse era
                `unsized-images`, que as dimensões sozinhas resolvem. */}
            <img
              src={promo.image}
              alt=""
              width={270}
              height={224}
              className="hidden w-[270px] shrink-0 object-cover sm:block"
            />
            <div className="flex flex-1 flex-col items-end gap-3 p-6 text-right">
              <h3 className="whitespace-pre-line text-body-18 font-bold leading-[22px] text-foreground">
                {promo.title}
              </h3>
              <p className="text-body-14 leading-[22px] text-text-secondary">{promo.body}</p>
              <Link
                to="/"
                hash="catalogo"
                className={cn(
                  linkFocusRing,
                  'mt-1 inline-flex items-center gap-2 rounded-[6px] bg-primary px-4 py-2 text-body-14 font-bold text-primary-foreground',
                )}
              >
                Explorar
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        ))}
      </section>

      <section aria-labelledby="diario" className="mt-14">
        <h2
          id="diario"
          className="text-center text-heading-24 font-bold leading-[32px] text-foreground"
        >
          Diário da Cunhagem
        </h2>
        <p className="mt-2 text-center text-body-14 text-text-secondary">
          Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.
        </p>

        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {POSTS.map((post) => (
            <li key={post.title} className="overflow-hidden rounded-[14px] bg-card">
              <img
                src={post.image}
                alt=""
                width={280}
                height={190}
                  className="h-[190px] w-full object-cover"
              />
              <div className="flex flex-col gap-2 p-4">
                <p className="text-tiny-10 text-text-secondary">
                  {post.date} <span aria-hidden>|</span> {post.read}
                </p>
                <h3 className="text-body-15 font-bold leading-[20px] text-foreground">
                  {post.title}
                </h3>
                <p className="text-body-14 leading-[18px] text-text-secondary">{post.body}</p>
                {/* NÃO é link: as matérias não existem. Mesmo tratamento de
                    "Criadores" e "Aprenda" no header — texto inerte é mais
                    honesto que um link que devolveria 404. */}
                <span aria-disabled="true" className="text-body-14 text-text-accent">
                  Ler mais →
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
