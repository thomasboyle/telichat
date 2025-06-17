

export interface GroqServiceCallbacks {
  onResponseUpdate: (content: string) => void;
  onThinkingUpdate: (content: string) => void;
  onThinkingComplete: () => void;
  onComplete: () => void;
  onError: (error: string) => void;
  onSourcesUpdate?: (sources: Array<{ title: string; url: string }>) => void;
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
    contextMessages: Array<{ role: 'user' | 'assistant', content: string }> = [],
    images?: Array<{ data: string; type: string }>
  ): Promise<void> {
    try {
      // Test connection first
      const connectionOk = await GroqService.testConnection();
      if (!connectionOk) {
        callbacks.onError('Failed to connect to Groq API');
        return;
      }
      
      // Filter out any messages with empty content to prevent API errors
      const validContextMessages = contextMessages.filter(message => 
        message.content && message.content.trim().length > 0
      );
      
      // Prepare user message with optional images
      let userMessage: any = {
        role: 'user' as const,
        content: prompt
      };

      // If images are provided, format for vision-capable models
      if (images && images.length > 0) {
        userMessage.content = [
          {
            type: 'text',
            text: prompt
          },
          ...images.map(image => ({
            type: 'image_url',
            image_url: {
              url: image.data
            }
          }))
        ];
      }
      
      // Prepare messages with conversation context
      const messages = [
        ...validContextMessages,
        userMessage
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
        
        // Handle rate limit errors specifically
        if (response.status === 429) {
          let rateLimitMessage = 'Rate limit exceeded. Please wait a moment before trying again.';
          
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.error?.message) {
              // Extract rate limit details from the error message if available
              const message = errorData.error.message;
              if (message.includes('rate limit') || message.includes('too many requests')) {
                rateLimitMessage = `Rate limit exceeded: ${message}`;
              }
            }
          } catch (parseError) {
            // If we can't parse the error, use the default message
            console.log('Could not parse rate limit error details:', parseError);
          }
          
          callbacks.onError(rateLimitMessage);
          return;
        }
        
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
    let sourcesExtracted = false;
    let hasReceivedAnyContent = false;
    let buffer = ''; // Buffer for accumulating partial chunks

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        buffer += chunk;
        
        console.log('=== GROQ STREAMING CHUNK ===');
        console.log('Raw chunk:', chunk);
        console.log('Current buffer:', buffer);
        console.log('============================');
        
        // Process complete lines from buffer
        const lines = buffer.split('\n');
        // Keep the last line in buffer (might be incomplete)
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            console.log('Processing data line:', data);
            
            if (data === '[DONE]') {
              console.log('Stream completed with [DONE]');
              callbacks.onComplete();
              return;
            }
            
            if (data === '') {
              continue; // Skip empty data lines
            }
            
            try {
              const parsed: any = JSON.parse(data);
              console.log('Parsed response:', JSON.stringify(parsed, null, 2));
              
              // Check for error in the response (like rate limits that come with 200 status)
              if (parsed.error) {
                console.log('Error found in streaming response:', parsed.error);
                
                // Handle rate limit errors specifically
                if (parsed.error.code === 'rate_limit_exceeded' || parsed.error.type === 'compound') {
                  let rateLimitMessage = 'Rate limit exceeded. Please wait before trying again.';
                  
                  if (parsed.error.message) {
                    // Extract wait time from the message if available
                    const waitTimeMatch = parsed.error.message.match(/Please try again in (\d+[hms]\d*[hms]?[\d.]*[hms]?)/);
                    if (waitTimeMatch) {
                      rateLimitMessage = `Rate limit exceeded. Please try again in ${waitTimeMatch[1]}.`;
                    } else {
                      rateLimitMessage = `Rate limit exceeded: ${parsed.error.message}`;
                    }
                  }
                  
                  callbacks.onError(rateLimitMessage);
                  return;
                }
                
                // Handle other errors
                callbacks.onError(parsed.error.message || 'An error occurred with the API request');
                return;
              }
              
              // Handle content updates - check both delta and message content
              let content = parsed.choices?.[0]?.delta?.content;
              
              // Some models might return content in message.content instead of delta.content
              if (!content && parsed.choices?.[0]?.message?.content) {
                content = parsed.choices?.[0]?.message?.content;
                console.log('Found content in message.content:', content);
              }
              
              if (content) {
                hasReceivedAnyContent = true;
                fullContent += content;
                console.log('Updating response with content:', content);
                console.log('Full content so far:', fullContent);
                callbacks.onResponseUpdate(fullContent);
              }
              
              // Extract sources from executed_tools if available
              const executedTools = parsed.choices?.[0]?.message?.executed_tools;
              console.log('Checking for executed_tools:', executedTools);
              
              // Also check for tool_calls in case it's in a different format
              const toolCalls = parsed.choices?.[0]?.message?.tool_calls;
              console.log('Checking for tool_calls:', toolCalls);
              
              // Check for function calls as well
              const functionCall = parsed.choices?.[0]?.message?.function_call;
              console.log('Checking for function_call:', functionCall);
              
              if (!sourcesExtracted && callbacks.onSourcesUpdate) {
                let sources: Array<{ title: string; url: string }> = [];
                
                // Try to extract from executed_tools
                if (executedTools) {
                  sources = GroqService.extractSourcesFromTools(executedTools);
                  console.log('Sources from executed_tools:', sources);
                }
                
                // Try to extract from tool_calls if no sources found yet
                if (sources.length === 0 && toolCalls) {
                  sources = GroqService.extractSourcesFromToolCalls(toolCalls);
                  console.log('Sources from tool_calls:', sources);
                }
                
                // Try to extract from function_call if no sources found yet
                if (sources.length === 0 && functionCall) {
                  sources = GroqService.extractSourcesFromFunctionCall(functionCall);
                  console.log('Sources from function_call:', sources);
                }
                
                // Check the entire parsed object for any search-related data
                if (sources.length === 0) {
                  console.log('No sources found in standard locations, checking entire response:', parsed);
                  sources = GroqService.extractSourcesFromAnyLocation(parsed);
                  console.log('Sources from any location:', sources);
                }
                
                if (sources.length > 0) {
                  callbacks.onSourcesUpdate(sources);
                  sourcesExtracted = true;
                  console.log('Successfully extracted and set sources:', sources);
                }
              }
            } catch (e) {
              // Handle JSON parsing errors more gracefully
              if (e instanceof SyntaxError && e.message.includes('Unterminated string')) {
                console.log('Detected unterminated JSON string, likely due to chunked data. Data:', data);
                // Try to extract any partial content that might be usable
                const partialContent = GroqService.extractPartialContent(data);
                if (partialContent) {
                  hasReceivedAnyContent = true;
                  fullContent += partialContent;
                  console.log('Extracted partial content:', partialContent);
                  callbacks.onResponseUpdate(fullContent);
                }
                continue;
              } else {
                console.log('Skipping chunk parse error:', e);
                console.log('Problematic data:', data);
              }
            }
          }
        }
      }
      
      // If we haven't received any content, log a warning
      if (!hasReceivedAnyContent) {
        console.warn('No content received from streaming response');
        callbacks.onError('No content received from the model. The model may not support streaming or returned an empty response.');
        return;
      }
      
      callbacks.onComplete();
    } catch (error) {
      callbacks.onError(error instanceof Error ? error.message : 'Streaming error');
    } finally {
      reader.releaseLock();
    }
  }

  private static extractSourcesFromTools(executedTools: Array<{ type: string; name: string; input: any; output: any }>): Array<{ title: string; url: string }> {
    const sources: Array<{ title: string; url: string }> = [];
    
    for (const tool of executedTools) {
      // Look for search tools (typically type 'search' based on the documentation)
      if (tool.type === 'search' || (tool.type === 'function' && (tool.name === 'web_search' || tool.name === 'tavily_search'))) {
        try {
          // The output should contain search results
          if (tool.output && typeof tool.output === 'string') {
            // Parse the output string to extract URLs and titles
            // The format from the documentation example shows:
            // "Title: ... \nURL: ... \nContent: ... \nScore: ..."
            const entries = tool.output.split('\n\n');
            
            for (const entry of entries) {
              const titleMatch = entry.match(/Title:\s*(.+)/);
              const urlMatch = entry.match(/URL:\s*(https?:\/\/[^\s]+)/);
              
              if (titleMatch && urlMatch) {
                const title = titleMatch[1].trim();
                const url = urlMatch[1].trim();
                
                // Avoid duplicates
                if (!sources.some(s => s.url === url)) {
                  sources.push({ title, url });
                }
              }
            }
          } else if (tool.output && typeof tool.output === 'object') {
            // Handle different possible object formats
            let results = tool.output.results || tool.output.organic_results || tool.output;
            
            if (Array.isArray(results)) {
              for (const result of results) {
                if (result.url && result.title) {
                  sources.push({
                    title: result.title,
                    url: result.url
                  });
                } else if (result.link && result.title) {
                  sources.push({
                    title: result.title,
                    url: result.link
                  });
                }
              }
            }
          }
        } catch (error) {
          console.error('Error parsing tool output:', error);
        }
      }
    }

    console.log('Extracted sources from executed_tools:', sources);
    return sources;
  }

  private static extractPartialContent(malformedJson: string): string | null {
    try {
      // Try to extract content from malformed JSON using regex
      // Look for content patterns commonly used in streaming responses
      const contentMatches = [
        /["']content["']\s*:\s*["']([^"']*)/,
        /["']delta["']\s*:\s*{[^}]*["']content["']\s*:\s*["']([^"']*)/,
        /["']message["']\s*:\s*{[^}]*["']content["']\s*:\s*["']([^"']*)/
      ];

      for (const pattern of contentMatches) {
        const match = malformedJson.match(pattern);
        if (match && match[1]) {
          console.log('Extracted partial content using pattern:', pattern);
          return match[1];
        }
      }

      return null;
    } catch (error) {
      console.log('Error extracting partial content:', error);
      return null;
    }
  }

  private static extractSourcesFromToolCalls(toolCalls: Array<any>): Array<{ title: string; url: string }> {
    const sources: Array<{ title: string; url: string }> = [];
    
    for (const toolCall of toolCalls) {
      try {
        // Check if this is a search-related tool call
        if (toolCall.function && (toolCall.function.name === 'web_search' || toolCall.function.name === 'tavily_search' || toolCall.function.name === 'search')) {
          // The result might be in toolCall.result or toolCall.function.result
          const result = toolCall.result || toolCall.function.result;
          if (result) {
            // Try to parse the result as both string and object
            if (typeof result === 'string') {
              const entries = result.split('\n\n');
              for (const entry of entries) {
                const titleMatch = entry.match(/Title:\s*(.+)/);
                const urlMatch = entry.match(/URL:\s*(https?:\/\/[^\s]+)/);
                
                if (titleMatch && urlMatch) {
                  const title = titleMatch[1].trim();
                  const url = urlMatch[1].trim();
                  
                  if (!sources.some(s => s.url === url)) {
                    sources.push({ title, url });
                  }
                }
              }
            } else if (typeof result === 'object' && result.results) {
              const results = result.results;
              if (Array.isArray(results)) {
                for (const searchResult of results) {
                  if (searchResult.url && searchResult.title) {
                    sources.push({
                      title: searchResult.title,
                      url: searchResult.url
                    });
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error parsing tool call:', error);
      }
    }
    
    return sources;
  }

  private static extractSourcesFromFunctionCall(functionCall: any): Array<{ title: string; url: string }> {
    const sources: Array<{ title: string; url: string }> = [];
    
    try {
      if (functionCall.name === 'web_search' || functionCall.name === 'tavily_search' || functionCall.name === 'search') {
        const result = functionCall.result || functionCall.arguments;
        if (result && typeof result === 'object' && result.results) {
          const results = result.results;
          if (Array.isArray(results)) {
            for (const searchResult of results) {
              if (searchResult.url && searchResult.title) {
                sources.push({
                  title: searchResult.title,
                  url: searchResult.url
                });
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error parsing function call:', error);
    }
    
    return sources;
  }

  private static extractSourcesFromAnyLocation(parsed: any): Array<{ title: string; url: string }> {
    const sources: Array<{ title: string; url: string }> = [];
    
    try {
      // Recursively search for any array that looks like search results
      const findSearchResults = (obj: any, path: string = '') => {
        if (obj && typeof obj === 'object') {
          // Check if this object has url and title properties (looks like a search result)
          if (obj.url && obj.title && typeof obj.url === 'string' && typeof obj.title === 'string') {
            if (!sources.some(s => s.url === obj.url)) {
              sources.push({ title: obj.title, url: obj.url });
              console.log(`Found source at path ${path}:`, obj.title, obj.url);
            }
          }
          
          // Recursively search through all properties
          for (const [key, value] of Object.entries(obj)) {
            const newPath = path ? `${path}.${key}` : key;
            if (Array.isArray(value)) {
              // If it's an array, check each item
              value.forEach((item, index) => {
                findSearchResults(item, `${newPath}[${index}]`);
              });
            } else if (value && typeof value === 'object') {
              findSearchResults(value, newPath);
            }
          }
        }
      };
      
      findSearchResults(parsed);
    } catch (error) {
      console.error('Error searching for sources in response:', error);
    }
    
    return sources;
  }
}

// Available Groq model configurations
export const GROQ_MODELS = {
  LLAMA_4_SCOUT_17B: 'meta-llama/llama-4-scout-17b-16e-instruct',
  COMPOUND_BETA_MINI: 'compound-beta-mini',
  MISTRAL_SABA_24B: 'mistral-saba-24b',
} as const;

export type GroqModelId = typeof GROQ_MODELS[keyof typeof GROQ_MODELS];

// Helper function to get model ID by app model name
export function getGroqModelIdForApp(appModelId: string): GroqModelId | null {
  switch (appModelId) {
    case 'groq':
      return GROQ_MODELS.COMPOUND_BETA_MINI; // Map Groq requests to compound-beta-mini model
    case 'llama':
      return GROQ_MODELS.LLAMA_4_SCOUT_17B; // Use Llama 4 Scout model
    case 'mistral':
      return GROQ_MODELS.MISTRAL_SABA_24B; // Mistral model
    default:
      return null;
  }
} 