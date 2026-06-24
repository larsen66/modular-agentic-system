// First-run-intent carry-through (design/auth/AREA.md §5 — "carry"). When a visitor types a prompt
// on the landing/chat surface before signing up, that intent is stashed in localStorage; we read it
// here so signup can carry it into user_metadata (`landing_intent_prompt`) and the post-auth shell
// can resume it. Same-origin compatible with the legacy app: same `cloved:first-run-intent` key and
// the same signup-eligible source set.

const STORAGE_KEY = 'cloved:first-run-intent'
const SIGNUP_INTENT_SOURCES = new Set(['chat-to-app', 'landing-page', 'landing-dubai-cta', 'landing-cta'])

interface FirstRunIntent {
  prompt?: string
  source?: string
}

function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function read(): FirstRunIntent | null {
  const raw = storage()?.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as FirstRunIntent
  } catch {
    return null
  }
}

/** The landing prompt to carry into signup, only when the stashed source is signup-eligible. */
export function readFirstRunIntentPromptForSignup(): string | null {
  const intent = read()
  if (!intent?.prompt || !intent.source || !SIGNUP_INTENT_SOURCES.has(intent.source)) return null
  return intent.prompt
}
