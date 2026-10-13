#!/usr/bin/env bash
# El harness local, en CI: corre los MISMOS hooks de .claude/hooks/ que bloquean al agente en el portátil,
# con el mismo payload que les manda Claude Code. Nada nuevo que mantener: si un hook cambia, el CI cambia.
#
# Truco: `git reset --soft` al merge-base con la rama base deja TODO el cambio del PR como staged, que es
# justo lo que miran guard-fence y guard-design en un `git commit`. Los gates de PR (cobertura, e2e) se
# disparan con el payload de `gh pr create`.
#
# Portable a propósito: GitHub Actions lo llama desde .github/workflows/ci.yml, y en GitLab CI basta un job
# con `make setup` + `scripts/ci/harness.sh "$CI_MERGE_REQUEST_TARGET_BRANCH_NAME"`.
#
# Uso:  scripts/ci/harness.sh <rama-base>      (necesita jq, node y el repo con historia: fetch-depth 0)
# En local también vale, pero los e2e reutilizan lo que haya en :3333 y :5173: con otra app ahí, prueban esa.

set -euo pipefail
BASE="${1:?uso: scripts/ci/harness.sh <rama-base>}"
export CLAUDE_PROJECT_DIR="$(git rev-parse --show-toplevel)"
cd "$CLAUDE_PROJECT_DIR"

git rev-parse -q --verify "origin/$BASE" >/dev/null || git fetch -q origin "$BASE:refs/remotes/origin/$BASE"
MB="$(git merge-base HEAD "origin/$BASE")"
ORIG="$(git rev-parse HEAD)"
trap 'git reset -q --soft "$ORIG"' EXIT   # al salir, HEAD vuelve a donde estaba (en local no se pierde nada)
git reset -q --soft "$MB"
echo "Cambio del PR (staged contra $BASE @ ${MB:0:7}):"
git diff --cached --stat | tail -n 1

COMMIT='{"tool_name":"Bash","tool_input":{"command":"git commit -m ci"}}'
PR='{"tool_name":"Bash","tool_input":{"command":"gh pr create --fill"}}'
FAILED=()

gate() {   # gate <nombre> <payload> <comando del hook...>
  local name="$1" payload="$2"; shift 2
  echo "::group::$name"
  if printf '%s' "$payload" | "$@"; then echo "✔ $name"; else FAILED+=("$name"); echo "✘ $name"; fi
  echo "::endgroup::"
}

gate "valla (guard-fence)"              "$COMMIT" .claude/hooks/guard-fence.sh
gate "valla del diseño (guard-design)"  "$COMMIT" .claude/hooks/guard-design.sh
gate "build + oxlint (guard-frontend)"  "$COMMIT" node .claude/hooks/guard-frontend.mjs
gate "suite + cobertura (guard-tests)"  "$PR"     node .claude/hooks/guard-tests.mjs
gate "e2e + axe (guard-frontend)"       "$PR"     node .claude/hooks/guard-frontend.mjs

if ((${#FAILED[@]})); then
  echo "::error::Puertas en rojo: ${FAILED[*]}"
  exit 1
fi
echo "Las cinco puertas del harness, en verde."
