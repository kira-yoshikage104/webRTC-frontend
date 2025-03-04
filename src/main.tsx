import { createRoot } from 'react-dom/client'
import { BrowserRouter as Router } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { WebSocketProvider } from './components/WebSocketContext.tsx'

createRoot(document.getElementById('root')!).render(
    <WebSocketProvider>
      <Router>
      <App />
      </Router>
    </WebSocketProvider>
)
