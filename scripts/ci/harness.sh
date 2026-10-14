#!/usr/bin/env bash
# El harness en CI: las MISMAS puertas que bloquean al agente en local, sin copiarlas.
# Corre los hooks de .claude/hooks/ tal cual, con el payload que les manda Claude Code por stdin
# ({"tool_name":"Bash","tool_input":{"command":"…"}}), así que una regla nueva en un hook vale a la
# vez para el agente y para el PR. Si el hook cambia, CI cambia con él: aquí no hay lógica de puertas.
#
#   git commit     → guard-fence.sh, guard-design.sh, guard-frontend.mjs (build + lint)
#   gh pr create   → guard-tests.mjs (suite + cobertura), guard-frontend.mjs (e2e)
#
# Los hooks de commit miran lo STAGED (git diff --cached). Para que juzguen el PR entero, el script
# hace `git reset --soft` al merge-base con origin/<base>: todo el cambio del PR queda staged. Al
# salir (bien, mal o con Ctrl-C) devuelve HEAD a donde estaba; el índice y el árbol no se tocan.
#
# Uso: scripts/ci/harness.sh <rama-base>     (p. ej. main; acepta también origin/main)
# Necesita el historial de la base: en GitHub Actions, actions/checkout con fetch-depth: 0.
# Una puerta que falla no corta las demás: al final sale con 1 y nombra las que fallaron.

set -eo pipefail

if [[ $# -ne 1 || -z "$1" ]]; then
  echo "Uso: $0 <rama-base>" >&2
  exit 64
fi
base="origin/${1#origin/}"

root="$(cd "$(dirname "$0")" && git rev-parse --show-toplevel)"
cd "$root"
hooks="$root/.claude/hooks"
# Los hooks resuelven la raíz del repo con esta variable, como cuando los lanza Claude Code.
export CLAUDE_PROJECT_DIR="$root"

if ! git rev-parse --verify --quiet "$base^{commit}" >/dev/null; then
  echo "No existe $base. ¿Falta un git fetch, o fetch-depth: 0 en actions/checkout?" >&2
  exit 1
fi
if ! merge_base="$(git merge-base HEAD "$base")"; then
  echo "No hay merge-base entre HEAD y $base: el clon es superficial (fetch-depth: 0)." >&2
  exit 1
fi

orig_head="$(git rev-parse HEAD)"
restore() {
  git reset --quiet --soft "$orig_head"
}
trap restore EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

git reset --quiet --soft "$merge_base"

if [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
  group_start() { echo "::group::$1"; }
  group_end() { echo "::endgroup::"; }
  report_failure() { echo "::error title=harness::$1"; }
else
  group_start() { printf '\n=== %s\n' "$1"; }
  group_end() { :; }
  report_failure() { echo "✗ $1"; }
fi

failed=""
gate() {
  local command="$1" hook="$2" name status
  name="$hook ($command)"
  group_start "$name"
  case "$hook" in
    *.mjs) set -- node "$hooks/$hook" ;;
    *) set -- "$hooks/$hook" ;;
  esac
  status=0
  printf '{"tool_name":"Bash","tool_input":{"command":"%s"}}' "$command" | "$@" 2>&1 || status=$?
  group_end
  if [[ $status -eq 0 ]]; then
    echo "✓ $name"
  else
    report_failure "$name: bloqueado (exit $status)"
    failed="${failed}  - ${name}"$'\n'
  fi
}

echo "Cambio del PR: $(git rev-parse --short "$merge_base")..$(git rev-parse --short "$orig_head") ($base), $(git diff --cached --name-only | wc -l | tr -d ' ') ficheros staged"

gate "git commit" guard-fence.sh
gate "git commit" guard-design.sh
gate "git commit" guard-frontend.mjs
gate "gh pr create" guard-tests.mjs
gate "gh pr create" guard-frontend.mjs

if [[ -n "$failed" ]]; then
  printf '\n⛔ Puertas del harness en rojo:\n%s' "$failed" >&2
  exit 1
fi
echo
echo "✓ Todas las puertas del harness en verde."
