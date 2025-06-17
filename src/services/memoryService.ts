export interface ConversationEntry {
  id: string;
  timestamp: number;
  prompt: string;
  response: string;
  modelId: string;
}

export interface ConversationMemory {
  entries: ConversationEntry[];
}

export class MemoryService {
  private static memory: ConversationMemory = { entries: [] };
  private static readonly MAX_ENTRIES = 10;
  
  // Initialize memory by loading from electron storage
  static async initialize(): Promise<void> {
    try {
      const savedMemory = await window.electronAPI.loadConversationMemory();
      if (savedMemory) {
        this.memory = savedMemory;
      }
    } catch (error) {
      console.error('Error loading conversation memory:', error);
    }
  }
  
  // Add a new conversation entry
  static async addEntry(prompt: string, response: string, modelId: string): Promise<void> {
    // Don't save entries with empty prompt or response
    if (!prompt.trim() || !response.trim()) {
      console.warn('Skipping conversation entry with empty prompt or response');
      return;
    }
    
    const entry: ConversationEntry = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      prompt,
      response,
      modelId
    };
    
    // Add to beginning and keep only the last MAX_ENTRIES
    this.memory.entries.unshift(entry);
    if (this.memory.entries.length > this.MAX_ENTRIES) {
      this.memory.entries = this.memory.entries.slice(0, this.MAX_ENTRIES);
    }
    
    // Persist to storage
    await this.save();
  }
  
  // Get conversation context for API calls (format for AI models)
  static getContextMessages(): Array<{ role: 'user' | 'assistant', content: string }> {
    const messages: Array<{ role: 'user' | 'assistant', content: string }> = [];
    
    // Add entries in chronological order (oldest first)
    const reversedEntries = [...this.memory.entries].reverse();
    
    for (const entry of reversedEntries) {
      // Only add messages with non-empty content
      if (entry.prompt && entry.prompt.trim()) {
        messages.push({ role: 'user', content: entry.prompt });
      }
      if (entry.response && entry.response.trim()) {
        messages.push({ role: 'assistant', content: entry.response });
      }
    }
    
    return messages;
  }
  
  // Get memory entries for display (newest first)
  static getEntries(): ConversationEntry[] {
    return [...this.memory.entries];
  }
  
  // Clear all memory
  static async clearMemory(): Promise<void> {
    this.memory.entries = [];
    await this.save();
  }
  
  // Get number of stored entries
  static getEntryCount(): number {
    return this.memory.entries.length;
  }
  
  // Private method to save memory to electron storage
  private static async save(): Promise<void> {
    try {
      await window.electronAPI.saveConversationMemory(this.memory);
    } catch (error) {
      console.error('Error saving conversation memory:', error);
    }
  }
  
  // Get context summary for display
  static getContextSummary(): string {
    const count = this.getEntryCount();
    if (count === 0) return 'No conversation history';
    if (count === 1) return '1 prompt in memory';
    return `${count} prompts in memory`;
  }
} 