#!/usr/bin/env node
/**
 * Hook PreToolUse (matcher: Bash). La Definition of Done, OBLIGADA — no sugerida.
 *
 *   git commit     → bloqueado si la suite del backend no está en verde.
 *   gh pr create   → bloqueado si la suite no está en verde O si la cobertura de líneas
 *                    de backend/app/ baja del suelo (COVERAGE_MIN).
 *
 * Lee el comando del agente por stdin ({ tool_input: { command } }) y bloquea con exit 2,
 * dejando el motivo en stderr: el agente lo lee y corrige. Intercepta la HERRAMIENTA de
 * shell, no git: `git commit --no-verify` no tiene nada que saltarse.
 *
 * Es el hermano de guard-fence.sh: aquel vigila el ALCANCE (la valla, BOUNDARIES.md);
 * este vigila la CALIDAD (principio II de la constitución). La constitución dice la regla;
 * este archivo la garantiza. Adaptado del hook guard-tests de la formación B2B de LIDR
 * (JUnit + JaCoCo) a AdonisJS + Japa + c8.
 *
 * Instalación: .claude/hooks/guard-tests.mjs + bloque PreToolUse en .claude/settings.json
 * (ver assets/.claude/settings.json, que ya lleva los dos hooks y el PostToolUse de Prettier).
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Suelo de cobertura de líneas de backend/app/. Es un RATCHET: se fija en lo medido y solo
// sube. Medido 63,6 % en s3b/start el 2026-09-29 (E1 sin tests, E2-1 cubierta). Subirlo es un
// PR aparte (principio II). La cobertura es respaldo; el listón es la matriz de comportamiento.
const COVERAGE_MIN = 60

let command = ''
try {
  command = JSON.parse(readFileSync(0, 'utf8'))?.tool_input?.command ?? ''
} catch {
  process.exit(0) // payload ilegible → no estorbar
}

const isPr = /\bgh\s+pr\s+create\b/.test(command)
const isCommit = /\bgit\s+commit\b/.test(command)
if (!isPr && !isCommit) process.exit(0) // todo lo demás pasa sin tocarse

const root = process.env.CLAUDE_PROJECT_DIR ?? resolve(import.meta.dirname, '..', '..')
const backend = resolve(root, 'backend')
const gate = isPr
  ? `abrir un PR exige la suite en verde Y cobertura de líneas de backend/app/ ≥ ${COVERAGE_MIN} %`
  : 'commitear exige la suite del backend en verde'

function block(detail) {
  process.stderr.write(`\n⛔ Bloqueado por guard-tests: ${gate}.\n`)
  process.stderr.write('   Rojo → verde → refactor. Arregla y vuelve a intentarlo; no edites el test para que pase.\n\n')
  process.stderr.write(`${detail}\n`)
  process.exit(2) // exit 2 → la herramienta no se ejecuta y stderr vuelve al agente
}

// 1. La suite tiene que estar en verde para las dos puertas. Si es un PR, se corre ya con
//    cobertura para no pasarla dos veces.
try {
  execSync(isPr ? 'npm run test:coverage' : 'npm test', {
    cwd: backend,
    stdio: 'pipe',
    env: { ...process.env, CI: '1' },
  })
} catch (err) {
  const out = `${err.stdout ?? ''}${err.stderr ?? ''}`
    .split('\n')
    .filter((line) => !/Truncated tables|Already up to date/.test(line))
    .join('\n')
    .trim()
  block(out.split('\n').slice(-25).join('\n') || 'La suite del backend ha fallado.')
}

// 2. Abrir un PR exige además que la cobertura no baje del suelo.
if (isPr) {
  const summary = resolve(backend, 'coverage', 'coverage-summary.json')
  if (!existsSync(summary)) {
    block('No existe backend/coverage/coverage-summary.json: ¿npm run test:coverage (c8) no ha generado la cobertura?')
  }
  const pct = JSON.parse(readFileSync(summary, 'utf8')).total.lines.pct
  if (pct < COVERAGE_MIN) {
    block(
      `Cobertura de líneas de backend/app/: ${pct.toFixed(1)} % (suelo: ${COVERAGE_MIN} %). ` +
        'Cubre la matriz que falta: camino feliz, 422, 401, 404.',
    )
  }
}

process.exit(0)
