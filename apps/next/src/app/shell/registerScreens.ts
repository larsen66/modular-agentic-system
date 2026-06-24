/**
 * Registry bootstrap — registers the initial hosted screens for the Stage.
 *
 * Import this module ONCE, at the AppShell mount site. Registration is idempotent
 * (re-registering overwrites silently — screenRegistry.ts §1). No side effects at module load
 * other than the registerScreen calls below; safe for StrictMode double-invocation.
 *
 * Screens registered here:
 *   'chat'    → island chat thread screen
 *   'preview' → island canvas preview screen
 */
import { registerScreen } from './screenRegistry'
import { ChatPane } from '@/features/chat'
import { KernelPreviewPane } from '@/features/canvas'

// 'chat' → the real chat surface (useChat → useChatRun → kernel run lane); the scaffold's placeholder
// ThreadScreen (local echo, no backend) is retired. 'preview' → the kernel preview iframe — the kernel
// emits preview_ready inline, so the legacy canvas snapshot PreviewScreen is unused on this path.
registerScreen('chat', ChatPane)
registerScreen('preview', KernelPreviewPane)
