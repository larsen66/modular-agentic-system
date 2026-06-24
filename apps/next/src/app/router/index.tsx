import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { routes } from './routes'

// Always basename='/'. Web dev (:8081) and prod (CF Pages) both serve at root.
// Electron also serves at root via app:// custom protocol.
const router = createBrowserRouter(routes, { basename: '/' })

export function IslandRouter() {
  return <RouterProvider router={router} />
}
