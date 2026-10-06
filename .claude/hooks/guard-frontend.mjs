#!/usr/bin/env node
/**
 * Hook PreToolUse (matcher: Bash). La Definition of Done del FRONTEND, obligada.
 *
 *   git commit     → si lo staged toca frontend/: bloqueado si `npm run build` (typecheck) o
 *                    `npm run lint` (oxlint) fallan. Rápido: segundos.
 *   gh pr create   → bloqueado si los e2e (`npm run test:e2e`: Playwright + axe) no están en verde.
 *                    Arranca backend y frontend si no están en marcha (playwright.config.ts).
 *
 * Mismo contrato que guard-tests.mjs, su hermano del backend: lee el comando por stdin
 * ({ tool_input: { command } }), bloquea con exit 2 y deja el motivo en stderr para que el agente
 * lo lea y corrija. Intercepta la HERRAMIENTA de shell, no git: `--no-verify` no se salta nada.
 *
 * Por qué el e2e va en el PR y no en cada commit: tarda (navegador + dos servidores) y el loop
 * rojo → verde hace commits intermedios. El PR es la puerta que importa; el commit, la barata.
 *
 * Instalación: assets/.claude/hooks/ → .claude/hooks/ + el bloque PreToolUse de
 * assets/.claude/settings.json (que ya lleva los cuatro hooks y el PostToolUse de Prettier).
 */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

let command = ''
try {
  command = JSON.parse(readFileSync(0, 'utf8'))?.tool_input?.command ?? ''
} catch {
  process.exit(0) // payload ilegible → no estorbar
}

const isPr = /\bgh\s+pr\s+create\b/.test(command)
const isCommit = /\bgit\s+commit\b/.test(command)
if (!isPr && !isCommit) process.exit(0)

const root = process.env.CLAUDE_PROJECT_DIR ?? resolve(import.meta.dirname, '..', '..')
const frontend = resolve(root, 'frontend')

function run(script) {
  execSync(`npm run ${script}`, {
    cwd: frontend,
    stdio: 'pipe',
    env: { ...process.env, CI: '1' },
  })
}

function block(gate, err) {
  const out = `${err.stdout ?? ''}${err.stderr ?? ''}`
    .split('\n')
    .filter((line) => !/DeprecationWarning|trace-deprecation|tracePromise/.test(line))
    .join('\n')
    .trim()
  process.stderr.write(`\n⛔ Bloqueado por guard-frontend: ${gate}.\n`)
  process.stderr.write('   Rojo → verde → refactor. Arregla y vuelve a intentarlo; no edites el test para que pase.\n\n')
  process.stderr.write(`${out.split('\n').slice(-30).join('\n')}\n`)
  process.exit(2)
}

if (isCommit) {
  // Solo si el commit toca el frontend: un commit de backend no paga el build del frontend.
  const staged = execSync('git diff --cached --name-only', { cwd: root, encoding: 'utf8' })
  if (!staged.split('\n').some((file) => file.startsWith('frontend/'))) process.exit(0)
  for (const script of ['build', 'lint']) {
    try {
      run(script)
    } catch (err) {
      block(`commitear frontend exige \`npm run ${script}\` limpio`, err)
    }
  }
}

if (isPr) {
  try {
    run('test:e2e')
  } catch (err) {
    block('abrir un PR exige los e2e en verde (Playwright + axe)', err)
  }
}

process.exit(0)
