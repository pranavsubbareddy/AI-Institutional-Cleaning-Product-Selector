import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import App from './App'
import './index.css'

// In production (GitHub Pages), the site is served at /AI-Institutional-Cleaning-Product-Selector/
// In development (Vite dev server), it's served at /
const basename = import.meta.env.PROD ? '/AI-Institutional-Cleaning-Product-Selector/' : '/';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
