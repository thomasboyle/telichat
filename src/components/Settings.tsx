import React, { useState, useEffect } from 'react';
import './Settings.css';

interface SettingsData {
  enabledModels: Record<string, boolean>;
}

interface ApiKeys {
  groq?: string;
  openai?: string;
  claude?: string;
  gemini?: string;
}

type SettingsSection = 'settings' | 'apis' | 'about';

const Settings: React.FC = () => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('settings');
  const [settings, setSettings] = useState<SettingsData>({
    enabledModels: {
      'groq': true,
      'claude': true,
      'gemini': true,
      'llama': true,
      'mistral': true,
      'deepseek': true
    }
  });
  const [apiKeys, setApiKeys] = useState<ApiKeys>({});
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<string>('');

  const models = [
    { id: 'groq', name: 'GroqSearch*', description: 'Groq-powered search model' },
    { id: 'claude', name: 'Claude', description: 'Anthropic Claude model' },
    { id: 'gemini', name: 'Gemini', description: 'Google Gemini model' },
    { id: 'llama', name: 'Llama*', description: 'Meta Llama model via LM Studio' },
    { id: 'mistral', name: 'Mistral*', description: 'Mistral model via LM Studio' },
    { id: 'deepseek', name: 'DeepSeek*', description: 'DeepSeek model via LM Studio' },
  ];

  useEffect(() => {
    loadData();
  }, []);

  // Handle ESC key to close settings window
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        window.close();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadData = async () => {
    try {
      const [settingsData, apiKeysData] = await Promise.all([
        window.electronAPI.loadSettings(),
        window.electronAPI.loadApiKeys()
      ]);
      
      setSettings(settingsData);
      setApiKeys(apiKeysData);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (newSettings: SettingsData, showStatus: boolean = true) => {
    try {
      if (showStatus) setSaveStatus('Saving...');
      await window.electronAPI.saveSettings(newSettings);
      setSettings(newSettings);
      if (showStatus) {
        setSaveStatus('Saved!');
        setTimeout(() => setSaveStatus(''), 2000);
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      if (showStatus) {
        setSaveStatus('Error saving');
        setTimeout(() => setSaveStatus(''), 2000);
      }
    }
  };

  const saveApiKeys = async (newApiKeys: ApiKeys) => {
    try {
      setSaveStatus('Saving...');
      await window.electronAPI.saveApiKeys(newApiKeys);
      setApiKeys(newApiKeys);
      setSaveStatus('Saved!');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (error) {
      console.error('Failed to save API keys:', error);
      setSaveStatus('Error saving');
      setTimeout(() => setSaveStatus(''), 2000);
    }
  };

  const handleModelToggle = (modelId: string) => {
    const newSettings = {
      ...settings,
      enabledModels: {
        ...settings.enabledModels,
        [modelId]: !settings.enabledModels[modelId]
      }
    };
    saveSettings(newSettings, false); // Don't show save status for toggles
  };

  const handleApiKeyChange = (service: keyof ApiKeys, value: string) => {
    const newApiKeys = {
      ...apiKeys,
      [service]: value
    };
    setApiKeys(newApiKeys);
  };

  const handleApiKeySave = () => {
    saveApiKeys(apiKeys);
  };

  const renderSettingsSection = () => (
    <div className="settings-content">
      <h2>Model Settings</h2>
      <p>Enable or disable AI models for use in the application.</p>
      
      <div className="model-list">
        {models.map((model) => (
          <div key={model.id} className="model-item">
            <div className="model-info">
              <h3>{model.name}</h3>
              <p>{model.description}</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.enabledModels[model.id] || false}
                onChange={() => handleModelToggle(model.id)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        ))}
      </div>
    </div>
  );

  const renderApisSection = () => (
    <div className="settings-content">
      <h2>API Configuration</h2>
      <p>Configure your own API keys to use external AI services.</p>
      
      <div className="api-keys-list">
        <div className="api-key-item">
          <label htmlFor="groq-key">Groq API Key</label>
          <input
            id="groq-key"
            type="password"
            placeholder="Enter your Groq API key"
            value={apiKeys.groq || ''}
            onChange={(e) => handleApiKeyChange('groq', e.target.value)}
          />
          <small>Used for GroqSearch* model</small>
        </div>

        <div className="api-key-item">
          <label htmlFor="openai-key">OpenAI API Key</label>
          <input
            id="openai-key"
            type="password"
            placeholder="Enter your OpenAI API key"
            value={apiKeys.openai || ''}
            onChange={(e) => handleApiKeyChange('openai', e.target.value)}
          />
          <small>Used for GPT models</small>
        </div>

        <div className="api-key-item">
          <label htmlFor="claude-key">Anthropic API Key</label>
          <input
            id="claude-key"
            type="password"
            placeholder="Enter your Anthropic API key"
            value={apiKeys.claude || ''}
            onChange={(e) => handleApiKeyChange('claude', e.target.value)}
          />
          <small>Used for Claude models</small>
        </div>

        <div className="api-key-item">
          <label htmlFor="gemini-key">Google API Key</label>
          <input
            id="gemini-key"
            type="password"
            placeholder="Enter your Google API key"
            value={apiKeys.gemini || ''}
            onChange={(e) => handleApiKeyChange('gemini', e.target.value)}
          />
          <small>Used for Gemini models</small>
        </div>
      </div>

      <button className="save-api-keys-btn" onClick={handleApiKeySave}>
        Save API Keys
      </button>
    </div>
  );

  const renderAboutSection = () => (
    <div className="settings-content">
      <h2>About</h2>
      <div className="about-content">
        <h3>AI Model Switcher</h3>
        <p>Version 1.0.0</p>
        <p>A powerful AI model switching application that allows you to seamlessly switch between different AI models and providers.</p>
        
        <h4>Features:</h4>
        <ul>
          <li>Quick model switching with drag-and-drop reordering</li>
          <li>Support for multiple AI providers (Groq, LM Studio, OpenAI, etc.)</li>
          <li>Conversation memory and context management</li>
          <li>Customizable model settings</li>
          <li>API key management</li>
        </ul>

        <h4>Keyboard Shortcuts:</h4>
        <ul>
          <li><kbd>Ctrl/Cmd + Space</kbd> - Show/Hide main window</li>
          <li><kbd>ESC</kbd> - Dismiss/Hide current window</li>
        </ul>

        <p>© 2024 AI Model Switcher. All rights reserved.</p>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="settings-container">
        <div className="loading">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="settings-container">
      <div className="settings-sidebar">
        <h1>Settings</h1>
        <nav className="settings-nav">
          <button
            className={`nav-item ${activeSection === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveSection('settings')}
          >
            Settings
          </button>
          <button
            className={`nav-item ${activeSection === 'apis' ? 'active' : ''}`}
            onClick={() => setActiveSection('apis')}
          >
            APIs
          </button>
          <button
            className={`nav-item ${activeSection === 'about' ? 'active' : ''}`}
            onClick={() => setActiveSection('about')}
          >
            About
          </button>
        </nav>
      </div>

      <div className="settings-main">
        {activeSection === 'settings' && renderSettingsSection()}
        {activeSection === 'apis' && renderApisSection()}
        {activeSection === 'about' && renderAboutSection()}
        
        {saveStatus && (
          <div className={`save-status ${saveStatus.includes('Error') ? 'error' : 'success'}`}>
            {saveStatus}
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings; 