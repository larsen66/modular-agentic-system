// Utility sign-in (pre-design). Replaced when the auth area gets its AREA brief. Not a designed area.
import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button, Card, CardContent, CardHeader } from '@heroui/react'
import { signInWithPassword, getCurrentUser } from '@/core/session'
import { Seo } from '@/shared/seo/Seo'
import { breadcrumbList } from '@/shared/seo/structuredData'
import { useShellStrings } from '../../i18n'

// Minimal email + password sign-in card. Centered full-viewport, no shell chrome.
// Reads `returnTo` from router location state (set by AuthGuard) and navigates there
// after successful sign-in. Redirects to '/' immediately if already authenticated.
export function Login() {
  const t = useShellStrings()
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo ?? '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Redirect away if already signed in (e.g. user manually navigates to /login)
  useEffect(() => {
    getCurrentUser().then((u) => { if (u) navigate(returnTo, { replace: true }) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const err = await signInWithPassword(email, password)
    setLoading(false)
    if (err) { setError(err); return }
    navigate(returnTo, { replace: true })
  }

  return (
    <div className="flex h-dvh w-full items-center justify-center bg-background p-4">
      <Seo
        title={`${t.login.title} — BOS.PRO`}
        canonical="https://bos.pro/login"
        noindex
        jsonLd={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: t.login.title, path: '/login' },
        ])}
      />
      <Card className="w-full max-w-sm">
        <CardHeader className="flex flex-col items-start gap-1 px-6 pb-0 pt-6">
          <h1 className="text-lg font-semibold text-foreground">{t.login.title}</h1>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="login-email" className="text-sm font-medium text-foreground">
                {t.login.email}
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                disabled={loading}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="login-password" className="text-sm font-medium text-foreground">
                {t.login.password}
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                disabled={loading}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
            </div>
            {error && (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            )}
            <Button
              type="submit"
              variant="primary"
              isDisabled={loading}
              className="mt-1 w-full"
            >
              {loading ? t.login.submitting : t.login.submit}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
