#!/usr/bin/env bash
# Hook PreToolUse (matcher: Bash). El control DETERMINISTA del alcance: la valla, obligada.
# Si el comando es un `git commit` y el staging toca la zona vallada de BOUNDARIES.md, bloquea (exit 2)
# y deja el motivo en stderr, que el agente lee. No gasta contexto, se dispara siempre, no depende de que
# nadie se acuerde. Es el hermano de guard-tests.mjs: aquel vigila la CALIDAD (suite, cobertura); este, el ALCANCE.
#
# Ojo: backend/database/schema.ts NO está en la regex a propósito. BOUNDARIES.md prohíbe editarlo A MANO, pero
# se regenera (y se commitea) cada vez que corre una migración, y un hook no distingue una cosa de la otra.
# Que nadie lo edite a mano lo comprueba el adversarial-reviewer, no este script.
#
# Instalación: viene en assets/.claude/hooks/ junto con guard-tests.mjs; assets/.claude/settings.json ya lleva
# el bloque PreToolUse de los dos (COMANDO 1c y 1d de PROMPTS.md). Los hooks se cargan al arrancar claude.

set -euo pipefail

input="$(cat)"
cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null || true)"
[[ "$cmd" == *"git commit"* ]] || exit 0

root="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
cd "$root"

# Debe coincidir con la lista "Nunca" de BOUNDARIES.md (menos schema.ts: ver cabecera).
fence='^(backend/app/controllers/(new_account|access_tokens|profile)_controller\.ts|backend/app/middleware/.*auth.*|backend/app/validators/user\.ts|backend/app/models/user\.ts|backend/database/migrations/.*(users|access_tokens).*|frontend/src/auth/)'
hits="$(git diff --cached --name-only | grep -E "$fence" || true)"
[[ -z "$hits" ]] && exit 0

{
  echo "BOUNDARIES.md: el commit toca la zona vallada:"
  printf '%s\n' "$hits" | sed 's/^/  - /'
  echo "Quita esos archivos del staging (git restore --staged <archivo>) o nombra un revisor humano en la spec."
} >&2
exit 2
