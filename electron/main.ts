import { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, nativeImage, screen, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Configure auto-updater
autoUpdater.autoDownload = false // Don't auto-download, let user choose
autoUpdater.autoInstallOnAppQuit = true

// Auto-updater logging
autoUpdater.logger = {
  info: (message: any) => console.log('AutoUpdater Info:', message),
  warn: (message: any) => console.warn('AutoUpdater Warn:', message),
  error: (message: any) => console.error('AutoUpdater Error:', message),
  debug: (message: any) => console.debug('AutoUpdater Debug:', message)
};

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null
let settingsWin: BrowserWindow | null = null
let tray: Tray | null = null
let isQuiting = false

// Auto-updater event handlers
autoUpdater.on('checking-for-update', () => {
  console.log('Checking for update...')
  // Notify renderer if window exists
  if (win && !win.isDestroyed()) {
    win.webContents.send('update-status', { status: 'checking' })
  }
})

autoUpdater.on('update-available', (info) => {
  console.log('Update available:', info)
  // Notify renderer if window exists
  if (win && !win.isDestroyed()) {
    win.webContents.send('update-status', { 
      status: 'available', 
      version: info.version,
      releaseDate: info.releaseDate
    })
  }
  // Start download automatically
  autoUpdater.downloadUpdate()
})

autoUpdater.on('update-not-available', (info) => {
  console.log('Update not available:', info)
  // Notify renderer if window exists
  if (win && !win.isDestroyed()) {
    win.webContents.send('update-status', { status: 'not-available' })
  }
})

autoUpdater.on('error', (err) => {
  console.log('Error in auto-updater:', err)
  // Notify renderer if window exists
  if (win && !win.isDestroyed()) {
    win.webContents.send('update-status', { status: 'error', error: err.message })
  }
})

autoUpdater.on('download-progress', (progressObj) => {
  let log_message = "Download speed: " + progressObj.bytesPerSecond
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%'
  log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')'
  console.log(log_message)
  
  // Notify renderer with progress
  if (win && !win.isDestroyed()) {
    win.webContents.send('update-status', { 
      status: 'downloading', 
      progress: Math.round(progressObj.percent),
      bytesPerSecond: progressObj.bytesPerSecond,
      transferred: progressObj.transferred,
      total: progressObj.total
    })
  }
})

autoUpdater.on('update-downloaded', (info) => {
  console.log('Update downloaded:', info)
  // Notify renderer that update is ready
  if (win && !win.isDestroyed()) {
    win.webContents.send('update-status', { 
      status: 'downloaded',
      version: info.version
    })
  }
  
  // Don't auto-install, let user choose via the UI
  console.log('Update ready to install. User can install via Settings > About > Install Now')
})

// Startup functionality helpers
function isAutoStartEnabled(): boolean {
  return app.getLoginItemSettings().openAtLogin
}

function toggleAutoStart(): void {
  const currentSetting = app.getLoginItemSettings()
  const newSetting = !currentSetting.openAtLogin
  
  app.setLoginItemSettings({
    openAtLogin: newSetting,
    path: process.execPath
  })
  
  // Save the preference to config file
  saveStartupPreference(newSetting)
  
  // Update tray menu to reflect the change
  updateTrayMenu()
}

function syncStartupSetting(): void {
  // Load saved preference
  const savedPreference = loadStartupPreference()
  const systemSetting = app.getLoginItemSettings().openAtLogin
  
  // If we have a saved preference and it differs from system setting, apply it
  if (savedPreference !== null && savedPreference !== systemSetting) {
    app.setLoginItemSettings({
      openAtLogin: savedPreference,
      path: process.execPath
    })
  } else if (savedPreference === null) {
    // If no saved preference, save the current system setting
    saveStartupPreference(systemSetting)
  }
}

function updateTrayMenu(): void {
  if (!tray) return
  
  const isAutoStart = isAutoStartEnabled()
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        if (win) {
          win.show()
          win.focus()
        }
      }
    },
    {
      label: 'Hide App',
      click: () => {
        if (win) {
          win.hide()
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        createSettingsWindow()
      }
    },
    {
      label: 'Check for Updates',
      click: () => {
        if (!VITE_DEV_SERVER_URL) {
          autoUpdater.checkForUpdatesAndNotify()
        }
      }
    },
    { type: 'separator' },
    {
      label: isAutoStart ? '✓ Start with Windows' : 'Start with Windows',
      click: toggleAutoStart
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuiting = true
        app.quit()
      }
    }
  ])
  
  tray.setContextMenu(contextMenu)
}

function getWindowPosition() {
  // Get the display where the cursor is currently located
  const cursorPosition = screen.getCursorScreenPoint()
  const currentDisplay = screen.getDisplayNearestPoint(cursorPosition)
  const { workArea } = currentDisplay
  
  const windowWidth = 800
  const windowHeight = 120
  
  // Calculate position: centered horizontally and at 30% from top vertically
  const x = workArea.x + Math.floor((workArea.width - windowWidth) / 2)
  const y = workArea.y + Math.floor(workArea.height * 0.3)
  
  return { x, y, width: windowWidth, height: windowHeight }
}

function createTray() {
  // Create tray icon using jackybot.jpg from assets
  let trayIcon
  
  // Path to jackybot.jpg in the src/assets directory (dev) or dist/assets (production)
  const iconPath = VITE_DEV_SERVER_URL 
    ? path.join(process.env.APP_ROOT || '', 'src', 'assets', 'jackybot.jpg')
    : path.join(process.env.APP_ROOT || '', 'dist', 'assets', 'jackybot.jpg')
  
  try {
    trayIcon = nativeImage.createFromPath(iconPath)
    if (!trayIcon.isEmpty()) {
      // Resize to appropriate tray icon size
      trayIcon = trayIcon.resize({ width: 16, height: 16 })
    } else {
      throw new Error('jackybot.jpg icon is empty')
    }
  } catch (error) {
    console.warn('Failed to load jackybot.jpg, using fallback icon:', error.message)
    // Platform-specific fallbacks
    if (process.platform === 'darwin') {
      trayIcon = nativeImage.createFromNamedImage('NSStatusNone')
    } else {
      // For Windows/Linux, create minimal empty icon - system will provide fallback
      trayIcon = nativeImage.createEmpty()
    }
  }
  
  tray = new Tray(trayIcon)
  
  // Set initial tray menu
  updateTrayMenu()
  tray.setToolTip('TeliChat')
  
  // Handle tray click events
  tray.on('click', () => {
    if (win) {
      if (win.isVisible()) {
        win.hide()
      } else {
        win.show()
        win.focus()
      }
    }
  })
  
  tray.on('double-click', () => {
    if (win) {
      win.show()
      win.focus()
    }
  })
}

function createWindow() {
  const isMac = process.platform === 'darwin'
  const isWindows = process.platform === 'win32'
  
  // Get initial window position
  const { x, y, width, height } = getWindowPosition()
  
  // Simplify icon loading - try the most likely path first
  let windowIcon: any
  let iconPath: string
  
  if (VITE_DEV_SERVER_URL) {
    iconPath = path.join(process.env.APP_ROOT || '', 'public', 'assets', 'jackybot.ico')
  } else {
    iconPath = path.join(RENDERER_DIST, 'assets', 'jackybot.ico')
  }
  
  // Ensure absolute path
  iconPath = path.resolve(iconPath)
  
  console.log('=== ICON DEBUG ===')
  console.log('Trying to load icon from:', iconPath)
  console.log('File exists:', fs.existsSync(iconPath))
  console.log('VITE_DEV_SERVER_URL:', VITE_DEV_SERVER_URL)
  console.log('RENDERER_DIST:', RENDERER_DIST)
  console.log('process.env.APP_ROOT:', process.env.APP_ROOT)
  
  if (fs.existsSync(iconPath)) {
    try {
      windowIcon = nativeImage.createFromPath(iconPath)
      console.log('Icon loaded successfully')
      console.log('Icon isEmpty:', windowIcon.isEmpty())
      console.log('Icon size:', windowIcon.getSize())
      console.log('Icon toDataURL length:', windowIcon.toDataURL().length)
    } catch (error) {
      console.error('Failed to create icon from path:', error)
      windowIcon = iconPath // Fallback to string path
    }
  } else {
    console.error('Icon file not found at:', iconPath)
    windowIcon = iconPath // Fallback to string path
  }
  
  console.log('Final windowIcon type:', typeof windowIcon)
  console.log('=== END ICON DEBUG ===')
  

  const windowOptions: any = {
    icon: windowIcon,
    width: width,
    height: height,
    x: x,
    y: y,
    minWidth: 800,
    minHeight: 120,
    maxHeight: 600,
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  }

  // Apply platform-specific transparency settings
  if (isMac) {
    windowOptions.vibrancy = 'under-window'
    windowOptions.transparent = true
  } else {
    windowOptions.transparent = true
  }

  win = new BrowserWindow(windowOptions)

  // Try setting icon after window creation for Windows taskbar
  if (process.platform === 'win32' && windowIcon && typeof windowIcon === 'object') {
    try {
      win.setIcon(windowIcon)
      console.log('Set window icon after creation')
    } catch (error) {
      console.warn('Failed to set window icon after creation:', error.message)
    }
  }

  // Prevent window from closing, hide to tray instead
  win.on('close', (event) => {
    if (!isQuiting) {
      event.preventDefault()
      win?.hide()
      return false
    }
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    if (win && !win.isDestroyed()) {
      try {
        win.webContents.send('main-process-message', (new Date).toLocaleString())
      } catch (error) {
        console.warn('Failed to send main-process-message:', error.message)
      }
    }
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

function createSettingsWindow() {
  // If settings window already exists, just focus it
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.show()
    settingsWin.focus()
    return
  }

  // Use the same icon as main window
  let windowIcon: any
  let iconPath: string
  
  if (VITE_DEV_SERVER_URL) {
    iconPath = path.join(process.env.APP_ROOT || '', 'public', 'assets', 'jackybot.ico')
  } else {
    iconPath = path.join(RENDERER_DIST, 'assets', 'jackybot.ico')
  }
  
  iconPath = path.resolve(iconPath)
  
  if (fs.existsSync(iconPath)) {
    try {
      windowIcon = nativeImage.createFromPath(iconPath)
    } catch (error) {
      windowIcon = iconPath // Fallback to string path
    }
  } else {
    windowIcon = iconPath // Fallback to string path
  }

  const windowOptions: any = {
    icon: windowIcon,
    width: 900,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
    autoHideMenuBar: true,
    show: false // Don't show until ready
  }

  settingsWin = new BrowserWindow(windowOptions)

  // Clean up reference when window is closed
  settingsWin.on('closed', () => {
    settingsWin = null
  })

  // Load the settings page
  if (VITE_DEV_SERVER_URL) {
    settingsWin.loadURL(`${VITE_DEV_SERVER_URL}#/settings`)
  } else {
    settingsWin.loadFile(path.join(RENDERER_DIST, 'index.html'), {
      hash: '/settings'
    })
  }

  // Show when ready
  settingsWin.once('ready-to-show', () => {
    if (settingsWin && !settingsWin.isDestroyed()) {
      try {
        settingsWin.show()
        settingsWin.focus()
      } catch (error) {
        console.warn('Failed to show settings window:', error.message)
      }
    }
  })
}

// With tray functionality, don't quit when all windows are closed
// The app will continue running in the tray
app.on('window-all-closed', () => {
  // On macOS, only quit if explicitly quitting
  if (process.platform === 'darwin' && isQuiting) {
    app.quit()
  }
  // On other platforms, keep running in tray unless explicitly quitting
  if (process.platform !== 'darwin' && isQuiting) {
    app.quit()
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  // Set app user model ID for proper Windows integration
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.telichat.app')
    
    // Force Windows to refresh taskbar icon
    try {
      const iconPath = VITE_DEV_SERVER_URL 
        ? path.join(process.env.APP_ROOT || '', 'public', 'assets', 'jackybot.ico')
        : path.join(process.env.APP_ROOT || '', 'dist', 'assets', 'jackybot.ico')
      
      const resolvedIconPath = path.resolve(iconPath)
      
      if (fs.existsSync(resolvedIconPath)) {
        // Additional Windows-specific settings
        console.log('Setting Windows app user model ID with icon path:', resolvedIconPath)
      }
    } catch (error) {
      console.warn('Error setting Windows integration:', error.message)
    }
  }
  
  // Set app icon globally for Windows - try multiple approaches
  if (process.platform === 'win32') {
    const appIconPath = VITE_DEV_SERVER_URL 
      ? path.join(process.env.APP_ROOT || '', 'public', 'assets', 'jackybot.ico')
      : path.join(process.env.APP_ROOT || '', 'dist', 'assets', 'jackybot.ico')
    
    const resolvedIconPath = path.isAbsolute(appIconPath) ? appIconPath : path.resolve(appIconPath)
    console.log('Setting global app icon:', resolvedIconPath)
    console.log('Global icon file exists:', fs.existsSync(resolvedIconPath))
    
    if (fs.existsSync(resolvedIconPath)) {
      try {
        const appIcon = nativeImage.createFromPath(resolvedIconPath)
        if (!appIcon.isEmpty()) {
          console.log('Successfully loaded global app icon')
          
          // Store the icon for use by windows
          global.appIcon = appIcon
          console.log('Stored global app icon for window use')
          
        } else {
          console.warn('Global app icon is empty')
        }
      } catch (error) {
        console.warn('Failed to load global app icon:', error.message)
      }
    }
  }
  
  createWindow()
  createTray()
  
  // Sync startup setting on app launch
  syncStartupSetting()
  
  // Initialize auto-updater after app is ready
  if (!VITE_DEV_SERVER_URL) {
    console.log('App version:', app.getVersion())
    console.log('Auto-updater feed URL:', autoUpdater.getFeedURL())
    
    // Only check for updates in production
    setTimeout(() => {
      console.log('Starting automatic update check...')
      autoUpdater.checkForUpdatesAndNotify()
    }, 3000) // Wait 3 seconds after app start
  } else {
    console.log('Running in development mode, auto-updater disabled')
  }

  globalShortcut.register('CommandOrControl+Space', () => {
    if (win && !win.isDestroyed()) {
      if (win.isVisible()) {
        win.hide()
      } else {
        // Reposition window to current cursor screen before showing
        const { x, y } = getWindowPosition()
        win.setPosition(x, y)
        win.show()
        win.focus()
        // Send focus-input message to renderer after a short delay
        setTimeout(() => {
          if (win && !win.isDestroyed()) {
            try {
              win.webContents.send('focus-input')
            } catch (error) {
              console.warn('Failed to send focus-input:', error.message)
            }
          }
        }, 100)
      }
    }
  })

  ipcMain.on('resize-window', (event, height) => {
    if (win && !win.isDestroyed()) {
      const [width] = win.getSize()
      const minHeight = 120
      const maxHeight = 600
      const constrainedHeight = Math.max(minHeight, Math.min(maxHeight, Math.round(height)))
      win.setSize(width, constrainedHeight)
    }
  })

  ipcMain.on('hide-main-window', () => {
    if (win && !win.isDestroyed()) {
      win.hide()
    }
  })

  // Handle model order persistence
  ipcMain.handle('load-model-order', () => {
    return loadModelOrder()
  })

  ipcMain.handle('save-model-order', (event, modelOrder: string[]) => {
    return saveModelOrder(modelOrder)
  })

  // Handle selected model persistence
  ipcMain.handle('load-selected-model', () => {
    return loadSelectedModel()
  })

  ipcMain.handle('save-selected-model', (event, selectedModelIndex: number) => {
    return saveSelectedModel(selectedModelIndex)
  })

  // Handle conversation memory persistence
  ipcMain.handle('load-conversation-memory', () => {
    return loadConversationMemory()
  })

  ipcMain.handle('save-conversation-memory', (event, memory: any) => {
    return saveConversationMemory(memory)
  })

  // Handle graceful shutdown requests (useful for uninstaller)
  ipcMain.handle('request-graceful-shutdown', () => {
    console.log('Graceful shutdown requested')
    isQuiting = true
    app.quit()
    return true
  })

  // Settings window handlers
  ipcMain.handle('load-settings', () => {
    return loadSettings()
  })

  ipcMain.handle('save-settings', (event, settings: any) => {
    const result = saveSettings(settings)
    // Notify all windows that settings have changed
    BrowserWindow.getAllWindows().forEach(window => {
      if (!window.isDestroyed()) {
        try {
          window.webContents.send('settings-changed', settings)
        } catch (error) {
          console.warn('Failed to send settings-changed to window:', error.message)
        }
      }
    })
    return result
  })

  ipcMain.handle('load-api-keys', () => {
    return loadApiKeys()
  })

  ipcMain.handle('save-api-keys', (event, apiKeys: any) => {
    return saveApiKeys(apiKeys)
  })

  // Auto-updater handlers
  ipcMain.handle('check-for-updates', async () => {
    if (!VITE_DEV_SERVER_URL) {
      try {
        console.log('Manually checking for updates...')
        await autoUpdater.checkForUpdatesAndNotify()
        return { success: true }
      } catch (error) {
        console.error('Error checking for updates:', error)
        if (win && !win.isDestroyed()) {
          win.webContents.send('update-status', { 
            status: 'error', 
            error: error instanceof Error ? error.message : 'Unknown error' 
          })
        }
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
      }
    } else {
      console.log('Skipping update check in development mode')
      if (win && !win.isDestroyed()) {
        win.webContents.send('update-status', { 
          status: 'error', 
          error: 'Updates are disabled in development mode' 
        })
      }
      return { success: false, error: 'Updates are disabled in development mode' }
    }
  })

  ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall()
    return { success: true }
  })

  // Get app version
  ipcMain.handle('get-app-version', () => {
    return app.getVersion()
  })

  // Open external URLs in default browser
  ipcMain.handle('open-external-url', async (event, url: string) => {
    try {
      await shell.openExternal(url)
      return { success: true }
    } catch (error) {
      console.error('Failed to open external URL:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })
})

// Handle system shutdown/restart signals
app.on('before-quit', (event) => {
  // If not already quitting, this is a system shutdown
  if (!isQuiting) {
    console.log('System shutdown detected, preparing to quit...')
    isQuiting = true
  }
})

app.on('will-quit', () => {
  // Unregister all shortcuts.
  globalShortcut.unregisterAll()
  
  // Clean up tray
  if (tray) {
    tray.destroy()
    tray = null
  }
})

// Get user data directory for storing config
const getUserDataPath = () => {
  return app.getPath('userData')
}

const getConfigPath = () => {
  return path.join(getUserDataPath(), 'model-order.json')
}

// Load model order from config file
const loadModelOrder = (): string[] | null => {
  try {
    const configPath = getConfigPath()
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8')
      const parsed = JSON.parse(data)
      return parsed.modelOrder || null
    }
  } catch (error) {
    console.error('Error loading model order:', error)
  }
  return null
}

// Load selected model index from config file
const loadSelectedModel = (): number | null => {
  try {
    const configPath = getConfigPath()
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8')
      const parsed = JSON.parse(data)
      return typeof parsed.selectedModelIndex === 'number' ? parsed.selectedModelIndex : null
    }
  } catch (error) {
    console.error('Error loading selected model:', error)
  }
  return null
}

// Save model order to config file
const saveModelOrder = (modelOrder: string[]): boolean => {
  try {
    const configPath = getConfigPath()
    const configDir = path.dirname(configPath)
    
    // Ensure the directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true })
    }
    
    // Load existing config to preserve other settings
    let existingConfig = {}
    if (fs.existsSync(configPath)) {
      try {
        const existingData = fs.readFileSync(configPath, 'utf-8')
        existingConfig = JSON.parse(existingData)
      } catch (error) {
        console.error('Error reading existing config:', error)
      }
    }
    
    const config = { ...existingConfig, modelOrder }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
    return true
  } catch (error) {
    console.error('Error saving model order:', error)
    return false
  }
}

// Save selected model index to config file
const saveSelectedModel = (selectedModelIndex: number): boolean => {
  try {
    const configPath = getConfigPath()
    const configDir = path.dirname(configPath)
    
    // Ensure the directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true })
    }
    
    // Load existing config to preserve other settings
    let existingConfig = {}
    if (fs.existsSync(configPath)) {
      try {
        const existingData = fs.readFileSync(configPath, 'utf-8')
        existingConfig = JSON.parse(existingData)
      } catch (error) {
        console.error('Error reading existing config:', error)
      }
    }
    
    const config = { ...existingConfig, selectedModelIndex }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
    return true
  } catch (error) {
    console.error('Error saving selected model:', error)
    return false
  }
}

// Load conversation memory from config file
const loadConversationMemory = (): any | null => {
  try {
    const configPath = getConfigPath()
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8')
      const parsed = JSON.parse(data)
      return parsed.conversationMemory || null
    }
  } catch (error) {
    console.error('Error loading conversation memory:', error)
  }
  return null
}

// Save conversation memory to config file
const saveConversationMemory = (memory: any): boolean => {
  try {
    const configPath = getConfigPath()
    const configDir = path.dirname(configPath)
    
    // Ensure the directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true })
    }
    
    // Load existing config to preserve other settings
    let existingConfig = {}
    if (fs.existsSync(configPath)) {
      try {
        const existingData = fs.readFileSync(configPath, 'utf-8')
        existingConfig = JSON.parse(existingData)
      } catch (error) {
        console.error('Error reading existing config:', error)
      }
    }
    
    const config = { ...existingConfig, conversationMemory: memory }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
    return true
  } catch (error) {
    console.error('Error saving conversation memory:', error)
    return false
  }
}

// Load startup preference from config file
const loadStartupPreference = (): boolean | null => {
  try {
    const configPath = getConfigPath()
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8')
      const parsed = JSON.parse(data)
      return typeof parsed.autoStart === 'boolean' ? parsed.autoStart : null
    }
  } catch (error) {
    console.error('Error loading startup preference:', error)
  }
  return null
}

// Save startup preference to config file
const saveStartupPreference = (autoStart: boolean): boolean => {
  try {
    const configPath = getConfigPath()
    const configDir = path.dirname(configPath)
    
    // Ensure the directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true })
    }
    
    // Load existing config to preserve other settings
    let existingConfig = {}
    if (fs.existsSync(configPath)) {
      try {
        const existingData = fs.readFileSync(configPath, 'utf-8')
        existingConfig = JSON.parse(existingData)
      } catch (error) {
        console.error('Error reading existing config:', error)
      }
    }
    
    const config = { ...existingConfig, autoStart }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
    return true
  } catch (error) {
    console.error('Error saving startup preference:', error)
    return false
  }
}

// Load settings from config file
const loadSettings = (): any => {
  try {
    const configPath = getConfigPath()
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8')
      const parsed = JSON.parse(data)
      return parsed.settings || {
        enabledModels: {
          'groq': true,
          'claude': true,
          'gemini': true,
          'llama': true,
          'mistral': true,
          'deepseek': true
        }
      }
    }
  } catch (error) {
    console.error('Error loading settings:', error)
  }
  return {
    enabledModels: {
      'groq': true,
      'claude': true,
      'gemini': true,
      'llama': true,
      'mistral': true,
      'deepseek': true
    }
  }
}

// Save settings to config file
const saveSettings = (settings: any): boolean => {
  try {
    const configPath = getConfigPath()
    const configDir = path.dirname(configPath)
    
    // Ensure the directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true })
    }
    
    // Load existing config to preserve other settings
    let existingConfig = {}
    if (fs.existsSync(configPath)) {
      try {
        const existingData = fs.readFileSync(configPath, 'utf-8')
        existingConfig = JSON.parse(existingData)
      } catch (error) {
        console.error('Error reading existing config:', error)
      }
    }
    
    const config = { ...existingConfig, settings }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
    return true
  } catch (error) {
    console.error('Error saving settings:', error)
    return false
  }
}

// Load API keys from config file
const loadApiKeys = (): any => {
  try {
    const configPath = getConfigPath()
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8')
      const parsed = JSON.parse(data)
      return parsed.apiKeys || {}
    }
  } catch (error) {
    console.error('Error loading API keys:', error)
  }
  return {}
}

// Save API keys to config file
const saveApiKeys = (apiKeys: any): boolean => {
  try {
    const configPath = getConfigPath()
    const configDir = path.dirname(configPath)
    
    // Ensure the directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true })
    }
    
    // Load existing config to preserve other settings
    let existingConfig = {}
    if (fs.existsSync(configPath)) {
      try {
        const existingData = fs.readFileSync(configPath, 'utf-8')
        existingConfig = JSON.parse(existingData)
      } catch (error) {
        console.error('Error reading existing config:', error)
      }
    }
    
    const config = { ...existingConfig, apiKeys }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
    return true
  } catch (error) {
    console.error('Error saving API keys:', error)
    return false
  }
}
