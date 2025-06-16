interface DeepSeekResponse {
  choices: Array<{
    delta?: {
      content?: string;
    };
    message?: {
      content?: string;
    };
  }>;
}

export interface DeepSeekServiceCallbacks {
  onResponseUpdate: (content: string) => void;
  onThinkingUpdate: (content: string) => void;
  onThinkingComplete: () => void;
  onComplete: () => void;
  onError: (error: string) => void;
}

export class LMStudioService {
  // Use direct LM Studio URLs for production, proxy for development
  private static readonly BASE_URL = import.meta.env.DEV 
    ? '/api/lm-studio' 
    : 'http://217.155.18.62:1234';
  private static readonly MODELS_ENDPOINT = `${LMStudioService.BASE_URL}/v1/models`;
  private static readonly CHAT_ENDPOINT = `${LMStudioService.BASE_URL}/v1/chat/completions`;

  static async testConnection(): Promise<boolean> {
    try {
      console.log('Testing LM Studio connection via proxy...');
      const response = await fetch(LMStudioService.MODELS_ENDPOINT, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      console.log('Models endpoint status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Available models:', data);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  static async sendPrompt(
    prompt: string, 
    modelId: string,
    callbacks: DeepSeekServiceCallbacks,
    contextMessages: Array<{ role: 'user' | 'assistant', content: string }> = []
  ): Promise<void> {
    try {
      // Test connection first
      const connectionOk = await LMStudioService.testConnection();
      if (!connectionOk) {
        callbacks.onError('Failed to connect to LM Studio');
        return;
      }
      
      // Prepare messages with conversation context
      const messages = [
        ...contextMessages,
        {
          role: 'user' as const,
          content: prompt
        }
      ];

      const requestBody = {
        model: modelId,
        messages: messages,
        stream: true,
        temperature: 0.7,
        max_tokens: 2000
      };

      console.log('=== LM STUDIO REQUEST DEBUG ===');
      console.log('URL:', LMStudioService.CHAT_ENDPOINT);
      console.log('Method: POST');
      console.log('Headers: Content-Type: application/json');
      console.log('Body Object:', requestBody);
      console.log('Body JSON:', JSON.stringify(requestBody, null, 2));
      console.log('Body length:', JSON.stringify(requestBody).length);
      
      // Verify the JSON is valid
      try {
        const testParse = JSON.parse(JSON.stringify(requestBody));
        console.log('JSON is valid, messages field exists:', 'messages' in testParse);
        console.log('Messages content:', testParse.messages);
      } catch (e) {
        console.error('JSON is invalid:', e);
      }
      console.log('==============================');

      const response = await fetch(LMStudioService.CHAT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify(requestBody)
      });

      console.log('=== LM STUDIO RESPONSE DEBUG ===');
      console.log('Status:', response.status);
      console.log('Status Text:', response.statusText);
      console.log('Headers:', Object.fromEntries(response.headers.entries()));
      console.log('===============================');

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response body:', errorText);
        callbacks.onError(`HTTP ${response.status}: ${errorText}`);
        return;
      }

      await LMStudioService.handleStreamingResponse(response, callbacks);
      
    } catch (error) {
      console.error('Error calling DeepSeek API:', error);
      callbacks.onError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private static async handleStreamingResponse(
    response: Response,
    callbacks: DeepSeekServiceCallbacks
  ): Promise<void> {
    const reader = response.body?.getReader();
    if (!reader) {
      callbacks.onError('No response body reader available');
      return;
    }

    const decoder = new TextDecoder();
    let fullContent = '';
    let currentThinking = '';
    let currentResponse = '';
    let isInThinkingMode = false;
    let hasClosedThinking = false;
    let thinkingEndIndex = -1;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              callbacks.onComplete();
              return;
            }
            
            try {
              const parsed: DeepSeekResponse = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullContent += content;
                
                // Check for thinking tags
                const thinkStartMatch = fullContent.match(/<think>/);
                const thinkEndMatch = fullContent.match(/<\/think>/);
                
                if (thinkStartMatch && !isInThinkingMode) {
                  isInThinkingMode = true;
                  console.log('Started thinking mode');
                  // Send any content before <think> tag as initial response
                  const beforeThink = fullContent.substring(0, thinkStartMatch.index);
                  if (beforeThink.trim()) {
                    currentResponse = beforeThink;
                    callbacks.onResponseUpdate(currentResponse);
                  }
                }
                
                if (isInThinkingMode && !hasClosedThinking) {
                  if (thinkEndMatch) {
                    // Extract thinking content between tags
                    const thinkStart = fullContent.indexOf('<think>') + 7;
                    const thinkEnd = fullContent.indexOf('</think>');
                    currentThinking = fullContent.substring(thinkStart, thinkEnd);
                    callbacks.onThinkingUpdate(currentThinking);
                    callbacks.onThinkingComplete();
                    
                    hasClosedThinking = true;
                    isInThinkingMode = false;
                    thinkingEndIndex = thinkEnd + 8;
                    
                    // Start showing response content after </think>
                    const afterThink = fullContent.substring(thinkingEndIndex);
                    if (afterThink.trim()) {
                      currentResponse = afterThink;
                      callbacks.onResponseUpdate(currentResponse);
                    }
                    
                    console.log('Completed thinking mode, starting response phase');
                  } else {
                    // Still in thinking mode, extract current thinking content
                    const thinkStart = fullContent.indexOf('<think>') + 7;
                    currentThinking = fullContent.substring(thinkStart);
                    callbacks.onThinkingUpdate(currentThinking);
                  }
                } else if (hasClosedThinking && thinkingEndIndex > -1) {
                  // After thinking is complete, show accumulated response content
                  currentResponse = fullContent.substring(thinkingEndIndex);
                  callbacks.onResponseUpdate(currentResponse);
                } else if (!isInThinkingMode && !thinkStartMatch) {
                  // Normal response without thinking
                  currentResponse = fullContent;
                  callbacks.onResponseUpdate(currentResponse);
                }
              }
            } catch (e) {
              // Ignore parsing errors for incomplete chunks
              console.log('Skipping chunk parse error:', e);
            }
          }
        }
      }
      
      callbacks.onComplete();
    } catch (error) {
      callbacks.onError(error instanceof Error ? error.message : 'Streaming error');
    } finally {
      reader.releaseLock();
    }
  }
}

// Available model configurations
export const LM_STUDIO_MODELS = {
  DEEPSEEK_R1: 'deepseek/deepseek-r1-0528-qwen3-8b',
  GEMMA_3: 'google/gemma-3-4b',
} as const;

export type LMStudioModelId = typeof LM_STUDIO_MODELS[keyof typeof LM_STUDIO_MODELS];

// Helper function to get model ID by app model name
export function getModelIdForApp(appModelId: string): LMStudioModelId | null {
  switch (appModelId) {
    case 'deepseek':
      return LM_STUDIO_MODELS.DEEPSEEK_R1;
    case 'gemma':
      return LM_STUDIO_MODELS.GEMMA_3;
    default:
      return null;
  }
} 