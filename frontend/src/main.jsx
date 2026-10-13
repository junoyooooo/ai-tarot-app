import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { WalletProvider } from './hooks/useWallet.jsx'
import './index.css'
import { initAnalytics } from './lib/analytics'
import { installGlobalTapSound } from './lib/sound'

initAnalytics()
installGlobalTapSound()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <WalletProvider>
      <App />
    </WalletProvider>
  </React.StrictMode>,
)
