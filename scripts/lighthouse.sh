#!/usr/bin/env bash
# Auditoria Lighthouse contra o BUILD DE PRODUCAO — nunca o dev server, que
# serve modulos nao-minificados e produz numeros que nao existem em producao.
# Uso: pnpm lighthouse    Resultados: .lighthouse/
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${LH_PORT:-4173}"
OUT="$ROOT/lighthouse-reports"
ROUTES=("/" "/nft/nft-001" "/carrinho")

# Esta maquina nao tem Chrome instalado; o Chromium do Playwright serve, e
# resolve-lo pela API evita fixar a versao do cache em caminho literal.
if [ -z "${CHROME_PATH:-}" ]; then
  CHROME_PATH="$(node -e "process.stdout.write(require('@playwright/test').chromium.executablePath())")"
fi
export CHROME_PATH

rm -rf "$OUT"
mkdir -p "$OUT"
pnpm build

PIDS="$(lsof -ti tcp:"$PORT" || true)"
if [ -n "$PIDS" ]; then
  echo "$PIDS" | xargs kill -9
  sleep 1
fi

pnpm preview --port "$PORT" --strictPort >"$OUT/preview.log" 2>&1 &
PREVIEW_PID=$!
trap 'kill $PREVIEW_PID 2>/dev/null || true' EXIT

for _ in $(seq 60); do
  if curl -sfo /dev/null "http://localhost:$PORT/"; then break; fi
  sleep 1
done
curl -sfo /dev/null "http://localhost:$PORT/" || { echo "preview nao subiu na porta $PORT"; exit 1; }

for form in desktop mobile; do
  # Lighthouse so tem preset 'desktop'; mobile (Moto G Power + 4G throttling)
  # e o default, e passar um preset inexistente aborta o CLI.
  if [ "$form" = desktop ]; then PRESET=(--preset=desktop); else PRESET=(); fi
  for route in "${ROUTES[@]}"; do
    slug="$(echo "${route#/}" | tr '/' '-')"
    if [ -z "$slug" ]; then slug=home; fi
    echo "== lighthouse $form $route"
    node "$ROOT/node_modules/lighthouse/cli/index.js" "http://localhost:$PORT$route" \
      ${PRESET[@]+"${PRESET[@]}"} \
      --output=json --output-path="$OUT/$form-$slug.json" \
      --quiet --chrome-flags="--headless=new --no-sandbox"
  done

  # `/perfil` exige sessão: anonimo ele redireciona para `/login` e a auditoria
  # mediria a tela errada. Semeia um perfil do Chrome com a sessão da ANA e roda
  # com `--disable-storage-reset` (sem isso o Lighthouse limpa o storage da
  # origem antes de navegar e derruba a sessão). Efeito colateral honesto: esse
  # flag também impede a limpeza de cache, então o run sai com cache quente e
  # NAO e comparavel com os demais.
  PROFILE="$OUT/chrome-profile-$form"
  rm -rf "$PROFILE"
  node "$ROOT/scripts/lh-seed.mjs" "$PROFILE" "http://localhost:$PORT"
  echo "== lighthouse $form /perfil (sessao ANA)"
  node "$ROOT/node_modules/lighthouse/cli/index.js" "http://localhost:$PORT/perfil" \
    ${PRESET[@]+"${PRESET[@]}"} \
    --disable-storage-reset \
    --output=json --output-path="$OUT/$form-perfil-auth.json" \
    --quiet --chrome-flags="--headless=new --no-sandbox --user-data-dir=$PROFILE"
  rm -rf "$PROFILE"
done

node "$ROOT/scripts/lighthouse-summary.mjs" >"$ROOT/docs/lighthouse.md"
cat "$ROOT/docs/lighthouse.md"
