import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import Settings from './components/Settings.tsx'

// Determine if this is the settings window based on URL hash only
const isSettingsWindow = window.location.hash === '#/settings'

console.log('Current URL hash:', window.location.hash)
console.log('Is settings window:', isSettingsWindow)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isSettingsWindow ? <Settings /> : <App />}
  </React.StrictMode>,
)

// Use contextBridge
window.ipcRenderer.on('main-process-message', (_event, message) => {
  console.log(message)
})
