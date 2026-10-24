import { MasterView } from './components/MasterView'
import { PublicView } from './components/PublicView'

function App() {
  const path = decodeURIComponent(window.location.pathname)
    .replace(/^\/+|\/+$/g, '')
    .trim()

  if (!path || path === 'index.html') return <PublicView />
  return <MasterView slug={path} />
}

export default App
