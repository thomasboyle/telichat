import { useState, useRef, useLayoutEffect, useEffect, useCallback } from 'react';
import ModelSelector from './components/ModelSelector';
import PromptInput from './components/PromptInput';
import './App.css';
import { arrayMove } from '@dnd-kit/sortable';
import './background.css';
import { LMStudioService, getModelIdForApp } from './services/lmStudioService';
import { GroqService, getGroqModelIdForApp } from './services/groqService';
import { MemoryService } from './services/memoryService';
import ReactMarkdown from 'react-markdown';

const initialModels = [
  { id: 'gpt-4', name: 'GroqSearch*' },
  { id: 'claude', name: 'Claude' },
  { id: 'gemini', name: 'Gemini' },
  { id: 'llama', name: 'Llama*' },
  { id: 'mistral', name: 'Mistral*' },
  { id: 'deepseek', name: 'DeepSeek*' },
];

interface ResponseViewProps {
  isLoading: boolean;
  response: string;
  prompt: string;
  thinkingContent: string;
  isThinking: boolean;
}

function ResponseView({ 
  isLoading, 
  response, 
  prompt, 
  thinkingContent, 
  isThinking
}: ResponseViewProps) {
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);
  const [copyButtonText, setCopyButtonText] = useState('Copy');

  const handleCopyResponse = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(response);
      setCopyButtonText('Copied!');
      setTimeout(() => setCopyButtonText('Copy'), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      setCopyButtonText('Failed');
      setTimeout(() => setCopyButtonText('Copy'), 2000);
    }
  }, [response]);

  const toggleThinking = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsThinkingExpanded(prev => !prev);
  }, []);

  // Only show loading spinner if we're loading and have no content at all
  if (isLoading && !response && !isThinking && !thinkingContent) {
    return <div className="loading-spinner-container"><div className="loading-spinner"></div></div>;
  }
  
  if (response || isThinking || thinkingContent) {
    return (
      <div className="response-display has-content">
        {prompt && <div className="prompt-display">{prompt}</div>}
        
        {(isThinking || thinkingContent) && (
          <div className="thinking-container">
            <div 
              className={`thinking-header ${isThinking ? 'processing' : ''}`}
              onClick={toggleThinking}
            >
              <span className="thinking-label">
                {isThinking ? 'Processing...' : 'Thinking Process'}
              </span>
              <span className={`thinking-arrow ${isThinkingExpanded ? 'expanded' : ''}`}>▼</span>
            </div>
            {isThinkingExpanded && (
              <div className="thinking-content">
                {thinkingContent || 'Thinking...'}
              </div>
            )}
          </div>
        )}
        
        {response && (
          <div className="response-section">
            <button 
              className="copy-button"
              onClick={handleCopyResponse}
              title="Copy response to clipboard"
            >
              {copyButtonText}
            </button>
            <div className="response-text">
              <ReactMarkdown>{response}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    );
  }
  return null;
}

function App() {
  const [models, setModels] = useState(initialModels);
  const [selectedModelIndex, setSelectedModelIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState('');
  const [prompt, setPrompt] = useState('');
  const [thinkingContent, setThinkingContent] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const appContainerRef = useRef<HTMLDivElement>(null);
  const streamingIntervalRef = useRef<NodeJS.Timeout | null>(null);



  // Consolidated window resize logic
  const handleWindowResize = useCallback(() => {
    const container = appContainerRef.current;
    if (!container) return;

    const contentHeight = container.scrollHeight;
    const maxWindowHeight = 600;
    const targetHeight = Math.min(contentHeight, maxWindowHeight);
    
    window.electronAPI.resizeWindow(targetHeight);
    
    const appMain = container.querySelector('.app-main') as HTMLElement;
    const appHeader = container.querySelector('.app-header') as HTMLElement;
    const appFooter = container.querySelector('.app-footer') as HTMLElement;
    
    if (appMain && appHeader && appFooter) {
      if (contentHeight >= maxWindowHeight) {
        appMain.style.overflowY = 'auto';
        const headerHeight = appHeader.offsetHeight;
        const footerHeight = appFooter.offsetHeight;
        const availableHeight = maxWindowHeight - headerHeight - footerHeight;
        appMain.style.maxHeight = `${availableHeight}px`;
        
        // Auto scroll to bottom for new content
        requestAnimationFrame(() => {
          appMain.scrollTop = appMain.scrollHeight;
        });
      } else {
        appMain.style.overflowY = 'hidden';
        appMain.style.maxHeight = 'none';
      }
    }
  }, []);

  // Function to update models based on settings
  const updateModelsFromSettings = useCallback(async (appSettings?: any) => {
    try {
      const [savedOrder, savedSelectedIndex] = await Promise.all([
        window.electronAPI.loadModelOrder(),
        window.electronAPI.loadSelectedModel()
      ]);
      
      // If settings not provided, load them
      if (!appSettings) {
        appSettings = await window.electronAPI.loadSettings();
      }
      
      // Filter models based on enabled settings
      let availableModels = initialModels;
      if (appSettings && appSettings.enabledModels) {
        availableModels = initialModels.filter(model => 
          appSettings.enabledModels[model.id] !== false
        );
      }
      
      let finalModels = availableModels;
      
      if (savedOrder && savedOrder.length > 0) {
        const reorderedModels = savedOrder.map((id: string) => 
          availableModels.find(model => model.id === id)
        ).filter(Boolean) as typeof availableModels;
        
        if (reorderedModels.length > 0) {
          finalModels = reorderedModels;
        }
      }
      
      setModels(finalModels);
      
      // Adjust selected index if current selection is no longer available
      if (finalModels.length > 0) {
        const currentSelectedModel = models[selectedModelIndex];
        const newSelectedIndex = finalModels.findIndex(model => model.id === currentSelectedModel?.id);
        
        if (newSelectedIndex >= 0) {
          setSelectedModelIndex(newSelectedIndex);
        } else if (savedSelectedIndex !== null && savedSelectedIndex >= 0 && savedSelectedIndex < finalModels.length) {
          setSelectedModelIndex(savedSelectedIndex);
        } else {
          // Default to first available model
          setSelectedModelIndex(0);
        }
      }
    } catch (error) {
      console.error('Failed to update models from settings:', error);
    }
  }, [models, selectedModelIndex]);

  // Load saved model order, selected model, settings, and initialize memory on app startup
  useEffect(() => {
    const loadSavedSettings = async () => {
      try {
        await MemoryService.initialize();
        await updateModelsFromSettings();
      } catch (error) {
        console.error('Failed to load saved settings:', error);
      }
    };
    
    loadSavedSettings();
  }, [updateModelsFromSettings]);

  // Listen for settings changes
  useEffect(() => {
    const cleanup = window.electronAPI.onSettingsChanged((newSettings) => {
      console.log('Settings changed, updating models:', newSettings);
      updateModelsFromSettings(newSettings);
    });
    
    return cleanup;
  }, [updateModelsFromSettings]);

  // Handle ESC key to hide app
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        window.electronAPI.hideMainWindow(); // Use IPC to properly hide to tray
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Set up ResizeObserver for dynamic window resizing
  useLayoutEffect(() => {
    const container = appContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(handleWindowResize);
    observer.observe(container);
    
    return () => observer.disconnect();
  }, [handleWindowResize]);

  // Trigger resize when content changes
  useEffect(() => {
    handleWindowResize();
  }, [response, isLoading, thinkingContent, handleWindowResize]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (streamingIntervalRef.current) {
        clearInterval(streamingIntervalRef.current);
      }
    };
  }, []);

  // Save model order
  const saveModelOrder = useCallback(async (newModels: typeof models) => {
    try {
      const modelIds = newModels.map(model => model.id);
      await window.electronAPI.saveModelOrder(modelIds);
    } catch (error) {
      console.error('Failed to save model order:', error);
    }
  }, []);

  // Save selected model
  const saveSelectedModel = useCallback(async (index: number) => {
    try {
      await window.electronAPI.saveSelectedModel(index);
    } catch (error) {
      console.error('Failed to save selected model:', error);
    }
  }, []);

  // Update selected model index with persistence
  const updateSelectedModelIndex = useCallback((index: number) => {
    setSelectedModelIndex(index);
    saveSelectedModel(index);
  }, [saveSelectedModel]);

  const resetResponseState = useCallback(() => {
    setResponse('');
    setThinkingContent('');
    setIsThinking(false);
  }, []);

  const callLocalModelAPI = useCallback(async (prompt: string, modelId: string) => {
    const lmStudioModelId = getModelIdForApp(modelId);
    if (!lmStudioModelId) {
      setResponse(`Error: No LM Studio model configured for ${modelId}`);
      setIsLoading(false);
      return;
    }

    const contextMessages = MemoryService.getContextMessages();
    let finalResponse = '';

    await LMStudioService.sendPrompt(
      prompt,
      lmStudioModelId,
      {
        onResponseUpdate: (content: string) => {
          finalResponse = content;
          setResponse(content);
        },
        onThinkingUpdate: (content: string) => {
          setThinkingContent(content);
          setIsThinking(true);
        },
        onThinkingComplete: () => {
          setIsThinking(false);
        },
        onComplete: async () => {
          setIsLoading(false);
          if (finalResponse.trim()) {
            await MemoryService.addEntry(prompt, finalResponse, modelId);
          }
        },
        onError: (error: string) => {
          setResponse(`Error connecting to ${modelId}: ${error}`);
          setIsLoading(false);
        }
      },
      contextMessages
    );
  }, []);

  const callGroqAPI = useCallback(async (prompt: string, modelId: string) => {
    const groqModelId = getGroqModelIdForApp(modelId);
    if (!groqModelId) {
      setResponse(`Error: No Groq model configured for ${modelId}`);
      setIsLoading(false);
      return;
    }

    const contextMessages = MemoryService.getContextMessages();
    let finalResponse = '';

    await GroqService.sendPrompt(
      prompt,
      groqModelId,
      {
        onResponseUpdate: (content: string) => {
          finalResponse = content;
          setResponse(content);
        },
        onThinkingUpdate: (content: string) => {
          setThinkingContent(content);
          setIsThinking(true);
        },
        onThinkingComplete: () => {
          setIsThinking(false);
        },
        onComplete: async () => {
          setIsLoading(false);
          if (finalResponse.trim()) {
            await MemoryService.addEntry(prompt, finalResponse, modelId);
          }
        },
        onError: (error: string) => {
          setResponse(`Error connecting to ${modelId}: ${error}`);
          setIsLoading(false);
        }
      },
      contextMessages
    );
  }, []);

  const handlePromptSubmit = useCallback(async (submittedPrompt: string) => {
    // Clear any existing interval
    if (streamingIntervalRef.current) {
      clearInterval(streamingIntervalRef.current);
      streamingIntervalRef.current = null;
    }

    setPrompt(submittedPrompt);
    setIsLoading(true);
    resetResponseState();

    const selectedModel = models[selectedModelIndex];
    
    const hasLMStudioModel = getModelIdForApp(selectedModel.id) !== null;
    const hasGroqModel = getGroqModelIdForApp(selectedModel.id) !== null;
    
    if (hasLMStudioModel) {
      await callLocalModelAPI(submittedPrompt, selectedModel.id);
    } else if (hasGroqModel) {
      await callGroqAPI(submittedPrompt, selectedModel.id);
    } else {
      // Mock AI response with optimized streaming
      const contextSummary = MemoryService.getContextSummary();
      const fullResponse = `This is a mock response to your prompt: "${submittedPrompt}" from ${selectedModel.name}. ${contextSummary}. This response is intentionally made longer to demonstrate how the window resizes and how the content will scroll once it exceeds the maximum height of the container which is set in the styles for the application. More text is added here to make it long enough.`;
      
      // Use a more efficient streaming approach
      const chars = [...fullResponse]; // Handle unicode properly
      let currentIndex = 0;
      
      streamingIntervalRef.current = setInterval(async () => {
        if (currentIndex < chars.length) {
          const chunk = chars.slice(0, currentIndex + 1).join('');
          setResponse(chunk);
          currentIndex++;
        } else {
          clearInterval(streamingIntervalRef.current!);
          streamingIntervalRef.current = null;
          setIsLoading(false);
          await MemoryService.addEntry(submittedPrompt, fullResponse, selectedModel.id);
        }
      }, 20);
    }
  }, [models, selectedModelIndex, resetResponseState, callLocalModelAPI, callGroqAPI]);

  const handleDragEnd = useCallback((event: any) => {
    const {active, over} = event;
    if (active && over && active.id !== over.id) {
      setModels((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        
        const selectedModelId = items[selectedModelIndex].id;
        const newItems = arrayMove(items, oldIndex, newIndex);
        const newSelectedIndex = newItems.findIndex(item => item.id === selectedModelId);
        setSelectedModelIndex(newSelectedIndex);
        
        saveModelOrder(newItems);
        
        return newItems;
      });
    }
  }, [selectedModelIndex, saveModelOrder]);

  return (
    <div className="app-container" ref={appContainerRef}>
      <header className="app-header">
        <PromptInput onSubmit={handlePromptSubmit} />
      </header>
      <main className="app-main">
        <ResponseView 
          isLoading={isLoading}
          response={response}
          prompt={prompt}
          thinkingContent={thinkingContent}
          isThinking={isThinking}
        />
      </main>
      <footer className="app-footer">
        <ModelSelector
          models={models}
          selectedIndex={selectedModelIndex}
          setSelectedIndex={updateSelectedModelIndex}
          onDragEnd={handleDragEnd}
        />
      </footer>
    </div>
  );
}

export default App;
