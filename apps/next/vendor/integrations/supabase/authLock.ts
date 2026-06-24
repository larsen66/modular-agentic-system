import { navigatorLock, processLock, type LockFunc } from '@supabase/auth-js';

type NavigatorLike = Pick<Navigator, 'locks' | 'userAgent'>;

type LockDependencies = {
  getNavigator: () => NavigatorLike | undefined;
  navigatorLock: LockFunc;
  processLock: LockFunc;
  warn: (message: string, error?: unknown) => void;
};

const BROWSER_LOCK_FALLBACK_MESSAGE =
  '[supabase] Navigator lock aborted during auth bootstrap; falling back to process lock.';

const DEFAULT_LOCK_DEPENDENCIES: LockDependencies = {
  getNavigator: () => (typeof navigator === 'undefined' ? undefined : navigator),
  navigatorLock,
  processLock,
  warn: () => {},
};

export const isAbortError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const name = 'name' in error ? String(error.name) : '';
  const message = 'message' in error ? String(error.message) : '';

  return name === 'AbortError' || message === 'The operation was aborted.';
};

export const hasNavigatorLockSupport = (navigatorLike?: NavigatorLike): boolean =>
  typeof navigatorLike?.locks?.request === 'function';

export const isSafariNavigatorLockEnvironment = (navigatorLike?: NavigatorLike): boolean => {
  if (!hasNavigatorLockSupport(navigatorLike)) {
    return false;
  }

  const userAgent = navigatorLike?.userAgent ?? '';

  return (
    /Safari\//.test(userAgent) &&
    !/(Chrome|Chromium|CriOS|Edg|EdgiOS|Firefox|FxiOS|OPR|OPiOS|SamsungBrowser)/.test(userAgent)
  );
};

export const createBrowserSafeSupabaseLock = (
  overrides: Partial<LockDependencies> = {}
): LockFunc => {
  const { getNavigator, navigatorLock, processLock, warn } = {
    ...DEFAULT_LOCK_DEPENDENCIES,
    ...overrides,
  };

  return async (name, acquireTimeout, fn) => {
    const navigatorLike = getNavigator();

    if (!hasNavigatorLockSupport(navigatorLike) || isSafariNavigatorLockEnvironment(navigatorLike)) {
      return await processLock(name, acquireTimeout, fn);
    }

    try {
      return await navigatorLock(name, acquireTimeout, fn);
    } catch (error) {
      if (!isAbortError(error)) {
        throw error;
      }

      warn(BROWSER_LOCK_FALLBACK_MESSAGE, error);

      return await processLock(name, acquireTimeout, fn);
    }
  };
};

export const supabaseAuthLock = createBrowserSafeSupabaseLock();
