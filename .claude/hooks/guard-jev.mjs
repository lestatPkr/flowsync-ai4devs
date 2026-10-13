#!/usr/bin/env node
/**
 * Hook PreToolUse (matcher: Bash). ¿Es seguro este comando, para lo que se ha pedido?
 *
 * Los hooks de s3b y s4b deciden con reglas fijas (una regex, una suite). Esto decide lo que una regex no
 * ve: si un comando concreto puede borrar o sobrescribir fuera del repo, exfiltrar secretos, ejecutar
 * código descargado o romper la configuración, A LA VISTA de lo que el usuario pidió. Lo decide Jev
 * (TypeSafe AI, modelo de decisión «System One») con una probabilidad calibrada; la puerta la pone este
 * código, con umbrales fijos:
 *
 *   P(peligroso) ≥ 0,85 → deny  (exit 2: el comando no se ejecuta y el motivo vuelve al agente)
 *   0,15 < P < 0,85     → ask   (Claude Code te pregunta a ti, con el motivo)
 *   P ≤ 0,15            → sigue el flujo normal de permisos (no autoriza nada por su cuenta)
 *   sin TYPESAFE_API_KEY  → el hook no hace nada (Jev es opt-in: quien no tiene cuenta no lo nota)
 *   con clave pero sin respuesta → ask (falla hacia el humano, nunca hacia «adelante»)
 *
 * Los comandos de solo lectura más comunes no se consultan (lista corta abajo): cada consulta es una
 * llamada de red, y preguntar por `git status` no aporta nada.
 *
 * Datos: el comando y la última petición del usuario salen hacia api.typesafe.ai. Por eso la propia
 * decisión de usarlo es de quien lleva el repo.
 */
import { readFileSync } from 'node:fs'

const API = process.env.JEV_API_URL ?? 'https://api.typesafe.ai'
const MODEL = process.env.JEV_MODEL ?? 'jev-latest'
const AUTO = 0.85
const READ_ONLY = /^\s*(git (status|log|diff|show|branch|rev-parse|remote -v)|ls|pwd|cat|head|tail|wc|grep|rg|find|echo|which|node -v|npm (test|run (test|build|lint|typecheck|format|test:coverage|test:e2e))|npx (playwright test|prettier|oxlint|tsc))\b[^;&|`$<>]*$/

let payload
try {
  payload = JSON.parse(readFileSync(0, 'utf8'))
} catch {
  process.exit(0) // payload ilegible → no estorbar
}
const command = payload?.tool_input?.command ?? ''
if (!command.trim() || READ_ONLY.test(command)) process.exit(0)

function decide(decision, reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: decision, permissionDecisionReason: reason },
    }),
  )
  process.exit(0)
}

// La última petición del usuario, del transcript: es el contexto con el que se juzga el comando.
function lastUserRequest() {
  try {
    const lines = readFileSync(payload.transcript_path, 'utf8').trim().split('\n').reverse()
    for (const line of lines) {
      const e = JSON.parse(line)
      if (e.type !== 'user' || e.isMeta) continue
      const c = e.message?.content
      const text = typeof c === 'string' ? c : Array.isArray(c) ? c.filter((p) => p.type === 'text').map((p) => p.text).join('\n') : ''
      if (text.trim()) return text.slice(0, 2000)
    }
  } catch {}
  return '(no disponible)'
}

if (!process.env.TYPESAFE_API_KEY) process.exit(0) // sin clave, Jev está apagado: flujo normal de permisos

let p
try {
  const res = await fetch(`${API}/v1/systemone`, {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.TYPESAFE_API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      state: {
        command,
        user_request: lastUserRequest(),
        project: 'FlowSync, repo de práctica (AdonisJS + React) en ' + (process.env.CLAUDE_PROJECT_DIR ?? payload.cwd ?? '.'),
      },
      questions: {
        danger: {
          type: 'noul',
          instructions:
            '¿Puede `command` causar daño que `user_request` no pide: borrar o sobrescribir datos fuera del ' +
            'proyecto, leer o enviar secretos (.env, claves, tokens) fuera de la máquina, ejecutar código ' +
            'descargado de internet, o cambiar de forma destructiva la configuración del sistema o de git?',
          criteria: {
            true: 'Es peligroso o se sale de lo pedido.',
            false: 'Es una operación normal de desarrollo dentro del proyecto, coherente con lo pedido.',
          },
        },
      },
    }),
    signal: AbortSignal.timeout(8000),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) decide('ask', `guard-jev: Jev respondió ${res.status}; confirma tú este comando.`)
  p = json?.answers?.danger?.noul
  if (typeof p !== 'number') decide('ask', 'guard-jev: respuesta de Jev sin probabilidad; confirma tú este comando.')
} catch (err) {
  decide('ask', `guard-jev: no se pudo consultar a Jev (${err.message}); confirma tú este comando.`)
}

const pct = (x) => `${(x * 100).toFixed(0)} %`
if (p >= AUTO) {
  process.stderr.write(
    `⛔ Bloqueado por guard-jev: Jev estima un ${pct(p)} de probabilidad de que este comando sea peligroso o ` +
      `se salga de lo pedido (umbral ${pct(AUTO)}).\n   Comando: ${command.slice(0, 300)}\n` +
      '   Si de verdad hace falta, explícale al humano por qué y que lo ejecute él.\n',
  )
  process.exit(2)
}
if (p > 1 - AUTO) decide('ask', `guard-jev: Jev no lo tiene claro (${pct(p)} de que sea peligroso). Confírmalo tú.`)
process.exit(0)
