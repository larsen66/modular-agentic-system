import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Button, Spinner } from '@heroui/react'
import { verifyToken } from '@/core/auth'
import { Seo } from '@/shared/seo/Seo'
import { AuthScreen } from '@/shared/auth/AuthScreen'
import { useAuthStrings } from '../../i18n'
import { safeReturnTo } from '@/app/auth/safeReturnTo'

type VerifyState = 'loading' | 'success' | 'error'

const REDIRECT_DELAY_MS = 1500
const RETURN_PATH_KEY = 'verifyReturnPath'

/**
 * Token-landing page for every Supabase/edge email link (design/auth/screens/auth-verify.md).
 *
 * Reads ?token=&type= from the URL and validates the token via core/auth.verifyToken exactly once
 * (a ref one-shot guards against React StrictMode's double-invoke and the "token already used" false
 * error it would cause). Three states: loading → success (then auto-redirect) → error (manual escape
 * to /login). On success: password_reset hands off to /reset-password; otherwise we route to the
 * one-shot `verifyReturnPath` (open-redirect-guarded by safeReturnTo) or "/". Missing token/type
 * renders the error state without calling the edge fn. The redirect timer is cleared on unmount.
 */
export function AuthVerify() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const t = useAuthStrings()

  const token = searchParams.get('token')
  const type = searchParams.get('type')

  const [state, setState] = useState<VerifyState>('loading')
  const [errorMsg, setErrorMsg] = useState<string>('')

  // One-shot guard: verifyToken must run exactly once even under StrictMode double-mount.
  const ranRef = useRef(false)
  // Track the redirect timer so we can clear it on unmount.
  const redirectTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true

    // Missing params → terminal error, no edge-fn call.
    if (!token || !type) {
      setErrorMsg(t.authVerify.errorBody)
      setState('error')
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const { error, userId } = await verifyToken(token, type)
        if (cancelled) return
        if (error) {
          setErrorMsg(error)
          setState('error')
          return
        }
        setState('success')
        redirectTimerRef.current = window.setTimeout(() => {
          if (type === 'password_reset') {
            navigate('/reset-password', { state: { userId, fromVerify: true } })
            return
          }
          const stored = sessionStorage.getItem(RETURN_PATH_KEY)
          sessionStorage.removeItem(RETURN_PATH_KEY)
          navigate(safeReturnTo(stored), { replace: true })
        }, REDIRECT_DELAY_MS)
      } catch (err) {
        if (cancelled) return
        // Keep dev logging on the catch path (legacy parity).
        console.error('[auth-verify] token verification failed', err)
        setErrorMsg(t.authVerify.errorBody)
        setState('error')
      }
    })()

    return () => {
      cancelled = true
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current)
        redirectTimerRef.current = null
      }
    }
    // Intentionally run once on mount; inputs are read from URL/i18n at first render. The ranRef
    // guard makes re-runs no-ops, but we keep the dep array stable to avoid re-arming the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <Seo title={t.authVerify.checking} noindex />
      <AuthScreen title={t.authVerify.checking}>
        {state === 'loading' ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <Spinner color="accent" size="lg" />
            <p className="text-sm text-muted-foreground">{t.authVerify.checking}</p>
          </div>
        ) : null}

        {state === 'success' ? (
          <Alert status="success">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{t.authVerify.successTitle}</Alert.Title>
              <Alert.Description>{t.authVerify.successBody}</Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}

        {state === 'error' ? (
          <>
            <Alert status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>{t.authVerify.errorTitle}</Alert.Title>
                <Alert.Description>{errorMsg || t.authVerify.errorBody}</Alert.Description>
              </Alert.Content>
            </Alert>
            <Button variant="primary" className="w-full" onPress={() => navigate('/login')}>
              {t.common.backToLogin}
            </Button>
          </>
        ) : null}
      </AuthScreen>
    </>
  )
}
