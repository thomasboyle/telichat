/// <reference types="vite/client" />

interface ConversationEntry {
  id: string;
  timestamp: number;
  prompt: string;
  response: string;
  modelId: string;
}

interface ConversationMemory {
  entries: ConversationEntry[];
}

interface Window {
  electronAPI: {
    startWindowDrag: () => void;
    resizeWindow: (height: number) => void;
    hideMainWindow: () => void;
    onFocusInput: (callback: () => void) => () => void;
    loadModelOrder: () => Promise<string[] | null>;
    saveModelOrder: (modelOrder: string[]) => Promise<boolean>;
    loadSelectedModel: () => Promise<number | null>;
    saveSelectedModel: (selectedModelIndex: number) => Promise<boolean>;
    loadConversationMemory: () => Promise<ConversationMemory | null>;
    saveConversationMemory: (memory: ConversationMemory) => Promise<boolean>;
    loadSettings: () => Promise<any>;
    saveSettings: (settings: any) => Promise<boolean>;
    loadApiKeys: () => Promise<any>;
    saveApiKeys: (apiKeys: any) => Promise<boolean>;
    onSettingsChanged: (callback: (settings: any) => void) => () => void;
    openUrl: (url: string) => Promise<{ success: boolean; error?: string }>;
  };
}
