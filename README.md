# AI Model Switcher

<div align="center">
  <img src="public/assets/jackybot.ico" alt="AI Model Switcher Logo" width="64" height="64">
  <h3>A powerful AI model management application with automatic updates</h3>
  
  [![Latest Release](https://img.shields.io/github/v/release/thomasboyle/telichat?style=flat-square)](https://github.com/thomasboyle/telichat/releases/latest)
  [![Downloads](https://img.shields.io/github/downloads/thomasboyle/telichat/total?style=flat-square)](https://github.com/thomasboyle/telichat/releases)
  [![License](https://img.shields.io/github/license/thomasboyle/telichat?style=flat-square)](LICENSE)
</div>

## 📥 Download

You can always find the latest release and downloads on the [**releases page**](https://github.com/thomasboyle/telichat/releases/latest).

> **Note**: AI Model Switcher is currently Windows-only. Linux and macOS support may be added in future releases.

> **Note**: AI Model Switcher includes automatic updates, so you'll always have the latest version!

## ✨ Features

- **🤖 Multiple AI Models**: Support for various AI models including local LM Studio and cloud-based services
- **⚡ Quick Access**: Global hotkey (`Ctrl+Space`) for instant access
- **🔄 Auto Updates**: Automatic updates delivered seamlessly
- **💾 Memory**: Remembers conversation context across sessions
- **🎨 Beautiful UI**: Modern, responsive interface with drag-and-drop model ordering
- **⚙️ Customizable**: Enable/disable specific models in settings
- **🔒 Secure**: API keys stored locally and encrypted
- **📱 System Tray**: Runs quietly in the background

## 🚀 Quick Start

### Installation (Windows)

1. **Download** the latest Setup Installer from the [releases page](https://github.com/thomasboyle/telichat/releases/latest).
2. **Run** the installer and follow the setup wizard
3. **Launch** AI Model Switcher from Start Menu or Desktop shortcut
4. **Press** `Ctrl+Space` anywhere to open the app

### Portable Version (Windows)

1. **Download** the latest Portable Version from the [releases page](https://github.com/thomasboyle/telichat/releases/latest).
2. **Run** the executable directly - no installation needed
3. **Press** `Ctrl+Space` anywhere to open the app

## 🎯 Usage

### Basic Usage
1. **Open**: Press `Ctrl+Space` or click the system tray icon
2. **Type**: Enter your prompt in the input field
3. **Select**: Choose your preferred AI model from the bottom selector
4. **Submit**: Press `Enter` or click submit to get your response

### Keyboard Shortcuts
- `Ctrl+Space` - Toggle app visibility
- `Enter` - Submit prompt
- `Escape` - Hide app

### System Tray Features
- **Show/Hide App** - Control visibility
- **Settings** - Configure models and API keys
- **Check for Updates** - Manual update check
- **Start with Windows** - Auto-start toggle

## ⚙️ Configuration

### Supported AI Models
- **GroqSearch** - Fast cloud-based inference
- **Claude** - Anthropic's AI assistant
- **Gemini** - Google's AI model
- **Llama** - Meta's open-source model (via LM Studio)
- **Mistral** - Efficient language model (via LM Studio)
- **DeepSeek** - Advanced reasoning model (via LM Studio)

### Setup Instructions
1. **Open Settings** from the system tray menu
2. **Configure API Keys** for cloud services (Groq, Claude, Gemini)
3. **Install LM Studio** for local models (optional)
4. **Enable/Disable Models** as needed

## 🔧 Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Setup
```bash
# Clone the repository
git clone https://github.com/thomasboyle/ai-model-switcher.git
cd ai-model-switcher

# Install dependencies
npm install

# Start development server
npm run dev
```

### Build
```bash
# Build for current platform
npm run build

# Build for all platforms
npm run build:all

# Build and publish release
npm run publish
```

## 🔄 Auto Updates

AI Model Switcher includes automatic update functionality:
- **Automatic Checks**: Updates are checked on app startup
- **Background Downloads**: Updates download in the background
- **Seamless Installation**: Updates install automatically with user notification
- **Manual Check**: Use "Check for Updates" in the system tray menu

## 📋 System Requirements

### Windows
- Windows 10 or later
- 100MB free disk space
- Internet connection for cloud models and updates

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the CC0-1.0 License - see the [LICENSE](LICENSE) file for details.

## 🐛 Issues & Support

If you encounter any issues or need support:
1. Check the [Issues](https://github.com/thomasboyle/telichat/issues) page
2. Create a new issue if your problem isn't already reported
3. Provide detailed information about your system and the problem

## 🙏 Acknowledgments

- Built with [Electron](https://electronjs.org/)
- UI components powered by [React](https://reactjs.org/)
- Auto-updates via [electron-updater](https://github.com/electron-userland/electron-updater)
- Icons and design inspiration from various open-source projects

---

<div align="center">
  Made with ❤️ by Thomas Boyle
</div>
