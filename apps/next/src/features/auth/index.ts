// Public surface of the `auth` feature module — the eight auth screens. Routes import from here;
// the screens compose core/auth + the shared auth widgets. (Guards live in src/app/auth/ since they
// wrap the shell, not the auth screens.)
export { Login } from './screens/login'
export { SignUp } from './screens/signup'
export { ForgotPassword } from './screens/forgot-password'
export { ResetPassword } from './screens/reset-password'
export { VerifyEmail } from './screens/verify-email'
export { AuthVerify } from './screens/auth-verify'
export { CompleteProfile } from './screens/complete-profile'
export { AcceptInvite } from './screens/accept-invite'
