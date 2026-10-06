#!/usr/bin/env bash
# Hook PreToolUse (matcher: Bash). La valla del DISEÑO: una sola fuente, obligada.
# Si el comando es un `git commit` y lo staged en frontend/src/ trae un color que no sale del design system,
# o modifica un componente generado de shadcn, bloquea (exit 2) y deja el motivo en stderr, que el agente lee.
#
# La fuente del diseño es DESIGN.md + los tokens de frontend/src/index.css (constitución, principio VI).
# Lo que este hook caza, en las LÍNEAS AÑADIDAS (lo heredado no se juzga):
#   1. Colores crudos en componentes: #hex, rgb()/rgba(), hsl(), oklch(). Solo index.css puede tenerlos.
#   2. Valores arbitrarios de color de Tailwind: bg-[#...], text-[rgb(...)], border-[color:...].
#   3. La paleta por defecto de Tailwind (bg-green-100, text-red-600...): se salta los tokens semánticos.
#   4. Ediciones a frontend/src/components/ui/: son generados (npx shadcn@latest add). Añadir uno nuevo, sí;
#      modificar uno existente, no: se compone por fuera.
# Si hace falta un color nuevo (p. ej. «hecho» en verde), el camino es un TOKEN: --success en index.css
# (claro y oscuro), su @theme inline, y la misma entrada en DESIGN.md. Entonces bg-success ya pasa.
#
# Es el hermano de guard-fence.sh (alcance: BOUNDARIES.md) y de guard-frontend.mjs (calidad: build, lint, e2e).
# Instalación: assets/.claude/hooks/ → .claude/hooks/ y el bloque PreToolUse de assets/.claude/settings.json.
# Los hooks se cargan al arrancar claude: tras copiar settings.json, reinicia.

set -euo pipefail

input="$(cat)"
cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null || true)"
[[ "$cmd" == *"git commit"* ]] || exit 0

root="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
cd "$root"

problems=""

# 4. Componentes generados: modificados, borrados o renombrados (añadidos sí pasan).
ui="$(git diff --cached --name-status -- frontend/src/components/ui/ | awk '$1 !~ /^A/ { print $NF }' || true)"
if [[ -n "$ui" ]]; then
  problems+="Modifica componentes generados de shadcn (frontend/src/components/ui/ no se edita a mano; se compone por fuera):"$'\n'
  problems+="$(printf '%s\n' "$ui" | sed 's/^/  - /')"$'\n'
fi

# 1-3. Líneas añadidas en frontend/src (menos index.css, que es donde viven los tokens, y menos ui/).
palette='(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)'
utility='(bg|text|border|ring|fill|stroke|outline|from|via|to|decoration|divide|placeholder|accent|caret|shadow)'
pattern="#[0-9a-fA-F]{3,8}\\b|rgba?\\(|hsla?\\(|oklch\\(|-\\[(#|rgb|hsl|oklch|color:)|\\b${utility}-${palette}-[0-9]{2,3}\\b"

hits="$(git diff --cached -U0 --no-color -- 'frontend/src/*.ts' 'frontend/src/*.tsx' 'frontend/src/*.css' \
  ':(exclude)frontend/src/index.css' ':(exclude)frontend/src/components/ui/*' |
  awk '/^\+\+\+ b\// { file = substr($0, 7); next } /^\+/ && !/^\+\+\+/ { print file ": " substr($0, 2) }' |
  grep -E "$pattern" || true)"
if [[ -n "$hits" ]]; then
  problems+="Usa colores que no salen del design system (solo tokens semánticos: bg-primary, text-muted-foreground…):"$'\n'
  problems+="$(printf '%s\n' "$hits" | sed 's/^/  - /' | cut -c1-200)"$'\n'
fi

[[ -z "$problems" ]] && exit 0

{
  echo "⛔ Bloqueado por guard-design: el diseño tiene una sola fuente (DESIGN.md + tokens de frontend/src/index.css)."
  printf '%s' "$problems"
  echo "¿Hace falta un color nuevo? Crea el token (index.css, claro y oscuro, y @theme inline) y documéntalo en DESIGN.md."
} >&2
exit 2
