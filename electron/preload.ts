import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },

  // You can expose other APTs you need here.
  // ...
})

// Expose window dragging functionality
contextBridge.exposeInMainWorld('electronAPI', {
  startWindowDrag: () => ipcRenderer.send('start-window-drag'),
  resizeWindow: (height: number) => ipcRenderer.send('resize-window', height),
  hideMainWindow: () => ipcRenderer.send('hide-main-window'),
  onFocusInput: (callback: () => void) => {
    ipcRenderer.on('focus-input', callback)
    return () => ipcRenderer.removeAllListeners('focus-input')
  },
  // Model order persistence
  loadModelOrder: (): Promise<string[] | null> => ipcRenderer.invoke('load-model-order'),
  saveModelOrder: (modelOrder: string[]): Promise<boolean> => ipcRenderer.invoke('save-model-order', modelOrder),
  // Selected model persistence
  loadSelectedModel: (): Promise<number | null> => ipcRenderer.invoke('load-selected-model'),
  saveSelectedModel: (selectedModelIndex: number): Promise<boolean> => ipcRenderer.invoke('save-selected-model', selectedModelIndex),
  // Conversation memory persistence
  loadConversationMemory: (): Promise<any> => ipcRenderer.invoke('load-conversation-memory'),
  saveConversationMemory: (memory: any): Promise<boolean> => ipcRenderer.invoke('save-conversation-memory', memory),
  // Settings management
  loadSettings: (): Promise<any> => ipcRenderer.invoke('load-settings'),
  saveSettings: (settings: any): Promise<boolean> => ipcRenderer.invoke('save-settings', settings),
  // API keys management  
  loadApiKeys: (): Promise<any> => ipcRenderer.invoke('load-api-keys'),
  saveApiKeys: (apiKeys: any): Promise<boolean> => ipcRenderer.invoke('save-api-keys', apiKeys),
  // Settings change listener
  onSettingsChanged: (callback: (settings: any) => void) => {
    ipcRenderer.on('settings-changed', (event, settings) => callback(settings))
    return () => ipcRenderer.removeAllListeners('settings-changed')
  },
  // Auto-updater functions
  checkForUpdates: (): Promise<{ success: boolean }> => ipcRenderer.invoke('check-for-updates'),
  installUpdate: (): Promise<{ success: boolean }> => ipcRenderer.invoke('install-update'),
  onUpdateStatus: (callback: (status: any) => void) => {
    ipcRenderer.on('update-status', (event, status) => callback(status))
    return () => ipcRenderer.removeAllListeners('update-status')
  },
  // Open external URLs in default browser
  openUrl: (url: string): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('open-external-url', url),
})
