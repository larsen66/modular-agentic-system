import { AppProviders } from './app/providers'
import { IslandRouter } from './app/router'

function App() {
  return (
    <AppProviders>
      <IslandRouter />
    </AppProviders>
  )
}

export default App
