#!/usr/bin/env bash
# El harness en CI: las MISMAS puertas que bloquean al agente en local, ahora también para humanos.
#
# Corre los hooks PreToolUse de .claude/hooks/ tal cual, con el mismo payload que les manda Claude Code
# por stdin ({"tool_name":"Bash","tool_input":{"command":"…"}}). No reimplementa ninguna regla: si un
# hook cambia, la CI cambia con él.
#
#   «git commit»    → guard-fence.sh, guard-design.sh, guard-frontend.mjs  (alcance, diseño, build + lint)
#   «gh pr create»  → guard-tests.mjs, guard-frontend.mjs                  (suite + cobertura, e2e)
#
# Los hooks de commit miran lo STAGED (git diff --cached). Para que juzguen el PR entero, el script hace
# git reset --soft al merge-base con origin/<base>: todo el cambio del PR queda staged y el árbol de
# trabajo no se toca. Al salir (bien, mal o por señal) devuelve HEAD a donde estaba.
#
# Cada puerta va en su propio grupo de salida; si una falla, siguen las demás. Termina con 1 nombrando
# las que fallaron. Un exit 2 es un bloqueo del hook; cualquier otro código distinto de 0 es que el hook
# ha reventado, y en CI también cuenta como fallo.
#
# Uso:    scripts/ci/harness.sh <rama-base>        p. ej. scripts/ci/harness.sh main
# Exige:  git, jq, node (lo mismo que los hooks en local). En CI, checkout con historia suficiente para
#         encontrar el merge-base (actions/checkout con fetch-depth: 0).
# Bash 3.2 compatible (el de macOS): sin arrays asociativos ni mapfile.

set -euo pipefail

if [[ $# -ne 1 || -z "$1" ]]; then
  echo "Uso: $0 <rama-base>   (p. ej. $0 main)" >&2
  exit 64
fi
base="$1"

for bin in git jq node; do
  command -v "$bin" >/dev/null 2>&1 || { echo "harness: falta '$bin' en el PATH." >&2; exit 69; }
done

root="$(git rev-parse --show-toplevel)"
cd "$root"
hooks="$root/.claude/hooks"
export CLAUDE_PROJECT_DIR="$root"

# --- Salida agrupada: plegable en GitHub Actions, con cabeceras en local -------------------------------
in_gha() { [[ "${GITHUB_ACTIONS:-}" == "true" ]]; }
group_start() { if in_gha; then echo "::group::$1"; else printf '\n━━━ %s ━━━\n' "$1"; fi; }
group_end() { if in_gha; then echo "::endgroup::"; fi; }
annotate_error() { if in_gha; then echo "::error title=harness::$1"; fi; }

# --- Rama base y merge-base ---------------------------------------------------------------------------
remote_ref="refs/remotes/origin/$base"
if ! git rev-parse --verify --quiet "$remote_ref^{commit}" >/dev/null; then
  echo "harness: no hay origin/$base en local; lo traigo." >&2
  git fetch --no-tags origin "+refs/heads/$base:$remote_ref"
fi

if ! merge_base="$(git merge-base HEAD "$remote_ref")"; then
  echo "harness: no hay merge-base entre HEAD y origin/$base. ¿Clon superficial? (fetch-depth: 0)" >&2
  exit 1
fi

orig_head="$(git rev-parse HEAD)"
if [[ -n "$(git diff --cached --name-only)" ]]; then
  echo "harness: aviso: ya había cambios staged; se juzgarán junto con el PR." >&2
fi

# --- Mover HEAD al merge-base y devolverlo SIEMPRE ----------------------------------------------------
restore_head() {
  local current
  current="$(git rev-parse HEAD 2>/dev/null || true)"
  if [[ "$current" != "$orig_head" ]]; then
    git reset --quiet --soft "$orig_head" && echo "harness: HEAD devuelto a ${orig_head:0:12}." >&2
  fi
}
trap restore_head EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

git reset --quiet --soft "$merge_base"
echo "harness: base origin/$base · merge-base ${merge_base:0:12} · HEAD ${orig_head:0:12}"
echo "harness: staged para el juicio:"
git diff --cached --stat | sed 's/^/  /'

# --- Las puertas --------------------------------------------------------------------------------------
payload() {
  jq -cn --arg cmd "$1" '{tool_name: "Bash", tool_input: {command: $cmd}}'
}

failed=""
ran=0

# run_gate <comando simulado> <hook>
run_gate() {
  local cmd="$1" hook="$2" label status
  label="$cmd → $hook"
  ran=$((ran + 1))

  group_start "$label"
  status=0
  # Igual que en .claude/settings.json: los .sh se ejecutan directamente; los .mjs, con node.
  case "$hook" in
    *.mjs) payload "$cmd" | node "$hooks/$hook" 2>&1 || status=$? ;;
    *) payload "$cmd" | "$hooks/$hook" 2>&1 || status=$? ;;
  esac

  if [[ $status -eq 0 ]]; then
    echo "✅ $label: pasa."
  elif [[ $status -eq 2 ]]; then
    echo "⛔ $label: BLOQUEADO (exit 2)."
  else
    echo "💥 $label: el hook ha fallado con exit $status."
  fi
  group_end

  if [[ $status -ne 0 ]]; then
    failed+="  - $label (exit $status)"$'\n'
    annotate_error "$label (exit $status)"
  fi
}

run_gate "git commit" guard-fence.sh
run_gate "git commit" guard-design.sh
run_gate "git commit" guard-frontend.mjs
run_gate "gh pr create" guard-tests.mjs
run_gate "gh pr create" guard-frontend.mjs

# --- Veredicto ----------------------------------------------------------------------------------------
echo
if [[ -n "$failed" ]]; then
  n="$(printf '%s' "$failed" | grep -c .)"
  echo "harness: $n de $ran puertas han fallado:"
  printf '%s' "$failed"
  exit 1
fi
echo "harness: las $ran puertas pasan."
