interface GroqResponse {
  choices: Array<{
    delta?: {
      content?: string;
    };
    message?: {
      content?: string;
    };
  }>;
}

export interface GroqServiceCallbacks {
  onResponseUpdate: (content: string) => void;
  onThinkingUpdate: (content: string) => void;
  onThinkingComplete: () => void;
  onComplete: () => void;
  onError: (error: string) => void;
}

export class GroqService {
  private static readonly BASE_URL = 'https://api.groq.com/openai/v1';
  private static readonly CHAT_ENDPOINT = `${GroqService.BASE_URL}/chat/completions`;
  private static readonly API_KEY = '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';

  static async testConnection(): Promise<boolean> {
    try {
      console.log('Testing Groq API connection...');
      const response = await fetch(GroqService.CHAT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GroqService.API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1,
          stream: false
        })
      });
      
      console.log('Groq API test status:', response.status);
      return response.ok || response.status === 400; // 400 is also acceptable for test
    } catch (error) {
      console.error('Groq connection test failed:', error);
      return false;
    }
  }

  static async sendPrompt(
    prompt: string, 
    modelId: string,
    callbacks: GroqServiceCallbacks,
    contextMessages: Array<{ role: 'user' | 'assistant', content: string }> = []
  ): Promise<void> {
    try {
      // Test connection first
      const connectionOk = await GroqService.testConnection();
      if (!connectionOk) {
        callbacks.onError('Failed to connect to Groq API');
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

      console.log('=== GROQ REQUEST DEBUG ===');
      console.log('URL:', GroqService.CHAT_ENDPOINT);
      console.log('Method: POST');
      console.log('Headers: Content-Type: application/json, Authorization: Bearer [API_KEY]');
      console.log('Body Object:', requestBody);
      console.log('Body JSON:', JSON.stringify(requestBody, null, 2));
      console.log('==========================');

      const response = await fetch(GroqService.CHAT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GroqService.API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify(requestBody)
      });

      console.log('=== GROQ RESPONSE DEBUG ===');
      console.log('Status:', response.status);
      console.log('Status Text:', response.statusText);
      console.log('Headers:', Object.fromEntries(response.headers.entries()));
      console.log('============================');

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response body:', errorText);
        callbacks.onError(`HTTP ${response.status}: ${errorText}`);
        return;
      }

      await GroqService.handleStreamingResponse(response, callbacks);
      
    } catch (error) {
      console.error('Error calling Groq API:', error);
      callbacks.onError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private static async handleStreamingResponse(
    response: Response,
    callbacks: GroqServiceCallbacks
  ): Promise<void> {
    const reader = response.body?.getReader();
    if (!reader) {
      callbacks.onError('No response body reader available');
      return;
    }

    const decoder = new TextDecoder();
    let fullContent = '';

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
              const parsed: GroqResponse = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullContent += content;
                callbacks.onResponseUpdate(fullContent);
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

// Available Groq model configurations
export const GROQ_MODELS = {
  LLAMA_3_3_70B: 'llama-3.3-70b-versatile',
  LLAMA_3_1_70B: 'llama-3.1-70b-versatile',
  LLAMA_3_1_8B: 'llama-3.1-8b-instant',
  COMPOUND_BETA_MINI: 'compound-beta-mini',
  MISTRAL_SABA_24B: 'mistral-saba-24b',
} as const;

export type GroqModelId = typeof GROQ_MODELS[keyof typeof GROQ_MODELS];

// Helper function to get model ID by app model name
export function getGroqModelIdForApp(appModelId: string): GroqModelId | null {
  switch (appModelId) {
    case 'gpt-4':
      return GROQ_MODELS.COMPOUND_BETA_MINI; // GroqSearch uses compound-beta-mini
    case 'llama':
      return GROQ_MODELS.LLAMA_3_3_70B; // Default to the most capable llama model
    case 'mistral':
      return GROQ_MODELS.MISTRAL_SABA_24B; // Mistral model
    default:
      return null;
  }
} 