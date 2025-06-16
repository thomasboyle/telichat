/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
}

// Used in Renderer process, expose in `preload.ts`
interface Window {
  ipcRenderer: import('electron').IpcRenderer,
  electronAPI: {
    startWindowDrag: () => void,
    resizeWindow: (height: number) => void,
    onFocusInput: (callback: () => void) => () => void,
    loadModelOrder: () => Promise<string[] | null>,
    saveModelOrder: (modelOrder: string[]) => Promise<boolean>,
    loadSelectedModel: () => Promise<number | null>,
    saveSelectedModel: (selectedModelIndex: number) => Promise<boolean>,
    loadConversationMemory: () => Promise<any>,
    saveConversationMemory: (memory: any) => Promise<boolean>,
    loadSettings: () => Promise<any>,
    saveSettings: (settings: any) => Promise<boolean>,
    loadApiKeys: () => Promise<any>,
    saveApiKeys: (apiKeys: any) => Promise<boolean>,
  }
}
