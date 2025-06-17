import { useState, useRef, useLayoutEffect, useEffect, useCallback, useMemo } from 'react';
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
  { id: 'groq', name: 'GroqSearch*' },
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
  sources?: Array<{ title: string; url: string }>;
}

const ResponseView = ({ 
  isLoading, 
  response, 
  prompt, 
  thinkingContent, 
  isThinking,
  sources
}: ResponseViewProps) => {
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);
  const [copyButtonText, setCopyButtonText] = useState('Copy');

  // Memoize handlers to prevent unnecessary re-renders
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

  const handleSourceClick = useCallback(async (url: string) => {
    try {
      await window.electronAPI.openUrl(url);
    } catch (error) {
      console.error('Failed to open URL:', error);
    }
  }, []);

  // Early return for loading state - no content at all
  if (isLoading && !response && !isThinking && !thinkingContent) {
    return <div className="loading-spinner-container"><div className="loading-spinner"></div></div>;
  }
  
  // Early return if no content to display
  if (!response && !isThinking && !thinkingContent) {
    return null;
  }

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

      {sources && sources.length > 0 && (
        <div className="sources-section">
          <div className="sources-header">
            <span className="sources-label">Sources</span>
          </div>
          <div className="sources-list">
            {sources.map((source, index) => (
              <div key={index} className="source-item">
                <div 
                  className="source-link"
                  onClick={() => handleSourceClick(source.url)}
                >
                  <span className="source-number">{index + 1}</span>
                  <span className="source-title">{source.title}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

function App() {
  const [models, setModels] = useState(initialModels);
  const [selectedModelIndex, setSelectedModelIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState('');
  const [prompt, setPrompt] = useState('');
  const [thinkingContent, setThinkingContent] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [sources, setSources] = useState<Array<{ title: string; url: string }>>([]);
  
  const appContainerRef = useRef<HTMLDivElement>(null);
  const streamingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Memoize the current selected model to avoid recalculation
  const selectedModel = useMemo(() => models[selectedModelIndex], [models, selectedModelIndex]);

  // Consolidated window resize logic - optimized with requestAnimationFrame
  const handleWindowResize = useCallback(() => {
    const container = appContainerRef.current;
    if (!container) return;

    requestAnimationFrame(() => {
      const contentHeight = container.scrollHeight;
      const maxWindowHeight = 600;
      const targetHeight = Math.min(contentHeight, maxWindowHeight);
      
      window.electronAPI.resizeWindow(targetHeight);
      
      const appMain = container.querySelector('.app-main') as HTMLElement;
      const appHeader = container.querySelector('.app-header') as HTMLElement;
      const appFooter = container.querySelector('.app-footer') as HTMLElement;
      
      if (appMain && appHeader && appFooter) {
        const isScrollable = contentHeight >= maxWindowHeight;
        appMain.style.overflowY = isScrollable ? 'auto' : 'hidden';
        
        if (isScrollable) {
          const headerHeight = appHeader.offsetHeight;
          const footerHeight = appFooter.offsetHeight;
          const availableHeight = maxWindowHeight - headerHeight - footerHeight;
          appMain.style.maxHeight = `${availableHeight}px`;
          
          // Auto scroll to bottom for new content
          requestAnimationFrame(() => {
            appMain.scrollTop = appMain.scrollHeight;
          });
        } else {
          appMain.style.maxHeight = 'none';
        }
      }
    });
  }, []);

  // Optimized state reset function
  const resetResponseState = useCallback(() => {
    // Batch state updates for better performance
    setResponse('');
    setThinkingContent('');
    setIsThinking(false);
    setSources([]);
  }, []);

  // Optimized save functions with error handling consolidated
  const saveData = useCallback(async (type: 'order' | 'selected', data: any) => {
    try {
      if (type === 'order') {
        await window.electronAPI.saveModelOrder(data.map((model: any) => model.id));
      } else {
        await window.electronAPI.saveSelectedModel(data);
      }
    } catch (error) {
      console.error(`Failed to save ${type}:`, error);
    }
  }, []);

  // Function to update models based on settings - optimized dependencies
  const updateModelsFromSettings = useCallback(async (appSettings?: any) => {
    try {
      const [savedOrder, savedSelectedIndex, settings] = await Promise.all([
        window.electronAPI.loadModelOrder(),
        window.electronAPI.loadSelectedModel(),
        appSettings || window.electronAPI.loadSettings()
      ]);
      
      // Migrate old gpt-4 settings to groq if needed
      let migratedSettings = settings;
      if (settings?.enabledModels && 'gpt-4' in settings.enabledModels && !('groq' in settings.enabledModels)) {
        migratedSettings = {
          ...settings,
          enabledModels: {
            ...settings.enabledModels,
            'groq': settings.enabledModels['gpt-4']
          }
        };
        // Remove the old gpt-4 setting
        delete migratedSettings.enabledModels['gpt-4'];
        // Save the migrated settings
        await window.electronAPI.saveSettings(migratedSettings);
        console.log('Migrated gpt-4 setting to groq');
      }
      
      // Filter models based on enabled settings
      let availableModels = initialModels;
      if (migratedSettings?.enabledModels) {
        availableModels = initialModels.filter(model => 
          migratedSettings.enabledModels[model.id] !== false
        );
      }
      
      // Apply saved order if available (migrate gpt-4 to groq in saved order)
      let finalModels = availableModels;
      if (savedOrder && savedOrder.length > 0) {
        // Migrate gpt-4 to groq in saved order
        const migratedOrder = savedOrder.map((id: string) => id === 'gpt-4' ? 'groq' : id);
        if (JSON.stringify(migratedOrder) !== JSON.stringify(savedOrder)) {
          await window.electronAPI.saveModelOrder(migratedOrder);
          console.log('Migrated model order: gpt-4 -> groq');
        }
        
        const reorderedModels = migratedOrder
          .map((id: string) => availableModels.find(model => model.id === id))
          .filter(Boolean) as typeof availableModels;
        
        if (reorderedModels.length > 0) {
          finalModels = reorderedModels;
        }
      }
      
      // Update models state
      setModels(finalModels);
      
      // Determine and set selected index
      if (finalModels.length > 0) {
        let newSelectedIndex = 0;
        
        if (savedSelectedIndex !== null && savedSelectedIndex >= 0 && savedSelectedIndex < finalModels.length) {
          newSelectedIndex = savedSelectedIndex;
        }
        
        setSelectedModelIndex(newSelectedIndex);
      }
    } catch (error) {
      console.error('Failed to update models from settings:', error);
    }
  }, []); // Remove dependencies to prevent unnecessary re-renders

  // Consolidated initialization effect
  useEffect(() => {
    const initializeApp = async () => {
      try {
        await MemoryService.initialize();
        await updateModelsFromSettings();
      } catch (error) {
        console.error('Failed to initialize app:', error);
      }
    };
    
    initializeApp();

    // ESC key handler
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        window.electronAPI.hideMainWindow();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    // Settings change listener
    const cleanup = window.electronAPI.onSettingsChanged(updateModelsFromSettings);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      cleanup();
    };
  }, [updateModelsFromSettings]);

  // Set up ResizeObserver for dynamic window resizing
  useLayoutEffect(() => {
    const container = appContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(handleWindowResize);
    observer.observe(container);
    
    return () => observer.disconnect();
  }, [handleWindowResize]);

  // Trigger resize when content changes - optimized dependency array
  useEffect(() => {
    handleWindowResize();
  }, [response, isLoading, thinkingContent, sources.length, handleWindowResize]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (streamingIntervalRef.current) {
        clearInterval(streamingIntervalRef.current);
        streamingIntervalRef.current = null;
      }
    };
  }, []);

  // Optimized model selection handler
  const updateSelectedModelIndex = useCallback((index: number) => {
    setSelectedModelIndex(index);
    saveData('selected', index);
  }, [saveData]);

  // Optimized API call handlers with shared callback structure
  const createAPICallbacks = useCallback((modelId: string) => ({
    onResponseUpdate: (content: string) => {
      setResponse(content);
    },
    onThinkingUpdate: (content: string) => {
      setThinkingContent(content);
      setIsThinking(true);
    },
    onThinkingComplete: () => {
      setIsThinking(false);
    },
    onSourcesUpdate: (sources: Array<{ title: string; url: string }>) => {
      setSources(sources);
    },
    onComplete: async (finalResponse: string) => {
      setIsLoading(false);
      if (finalResponse?.trim()) {
        await MemoryService.addEntry(prompt, finalResponse, modelId);
      }
    },
    onError: (error: string) => {
      setResponse(`Error connecting to ${modelId}: ${error}`);
      setIsLoading(false);
    }
  }), [prompt]);

  // Optimized API handlers with image support
  const callLocalModelAPI = useCallback(async (promptText: string, modelId: string, images?: Array<{ data: string; type: string }>) => {
    const lmStudioModelId = getModelIdForApp(modelId);
    if (!lmStudioModelId) {
      setResponse(`Error: No LM Studio model configured for ${modelId}`);
      setIsLoading(false);
      return;
    }

    const contextMessages = MemoryService.getContextMessages();
    const callbacks = createAPICallbacks(modelId);
    let finalResponse = '';

    await LMStudioService.sendPrompt(
      promptText,
      lmStudioModelId,
      {
        ...callbacks,
        onResponseUpdate: (content: string) => {
          finalResponse = content;
          callbacks.onResponseUpdate(content);
        },
        onComplete: async () => {
          await callbacks.onComplete(finalResponse);
        }
      },
      contextMessages,
      images
    );
  }, [createAPICallbacks]);

  const callGroqAPI = useCallback(async (promptText: string, modelId: string, images?: Array<{ data: string; type: string }>) => {
    const groqModelId = getGroqModelIdForApp(modelId);
    if (!groqModelId) {
      setResponse(`Error: No Groq model configured for ${modelId}`);
      setIsLoading(false);
      return;
    }

    const contextMessages = MemoryService.getContextMessages();
    const callbacks = createAPICallbacks(modelId);
    let finalResponse = '';

    await GroqService.sendPrompt(
      promptText,
      groqModelId,
      {
        ...callbacks,
        onResponseUpdate: (content: string) => {
          finalResponse = content;
          callbacks.onResponseUpdate(content);
        },
        onComplete: async () => {
          await callbacks.onComplete(finalResponse);
        }
      },
      contextMessages,
      images
    );
  }, [createAPICallbacks]);

  // Optimized mock response handler with image support
  const handleMockResponse = useCallback(async (submittedPrompt: string, modelName: string, images?: Array<{ data: string; type: string }>) => {
    const contextSummary = MemoryService.getContextSummary();
    const imageText = images && images.length > 0 ? ` I can see ${images.length} image${images.length !== 1 ? 's' : ''} you've shared.` : '';
    const fullResponse = `This is a mock response to your prompt: "${submittedPrompt}" from ${modelName}.${imageText} ${contextSummary}. This response is intentionally made longer to demonstrate how the window resizes and how the content will scroll once it exceeds the maximum height of the container which is set in the styles for the application. More text is added here to make it long enough.`;
    
    // Optimized streaming with better chunk handling
    const chars = [...fullResponse];
    let currentIndex = 0;
    
    streamingIntervalRef.current = setInterval(async () => {
      if (currentIndex < chars.length) {
        currentIndex++;
        setResponse(chars.slice(0, currentIndex).join(''));
      } else {
        clearInterval(streamingIntervalRef.current!);
        streamingIntervalRef.current = null;
        setIsLoading(false);
        await MemoryService.addEntry(submittedPrompt, fullResponse, selectedModel.id);
      }
    }, 20);
  }, [selectedModel.id]);

  // Auto-switch to llama model when images are detected
  const handleImageDetected = useCallback(() => {
    const llamaIndex = models.findIndex(model => model.id === 'llama');
    if (llamaIndex !== -1 && selectedModelIndex !== llamaIndex) {
      setSelectedModelIndex(llamaIndex);
      saveData('selected', llamaIndex);
    }
  }, [models, selectedModelIndex, saveData]);

  // Main prompt submit handler - optimized with early model checks and image support
  const handlePromptSubmit = useCallback(async (submittedPrompt: string, images?: Array<{ data: string; type: string }>) => {
    // Clear any existing interval
    if (streamingIntervalRef.current) {
      clearInterval(streamingIntervalRef.current);
      streamingIntervalRef.current = null;
    }

    setPrompt(submittedPrompt);
    setIsLoading(true);
    resetResponseState();

    // Auto-switch to llama model if images are provided and not already selected
    let modelToUse = selectedModel;
    if (images && images.length > 0) {
      const llamaIndex = models.findIndex(model => model.id === 'llama');
      if (llamaIndex !== -1) {
        modelToUse = models[llamaIndex];
        if (selectedModelIndex !== llamaIndex) {
          setSelectedModelIndex(llamaIndex);
          saveData('selected', llamaIndex);
        }
      }
    }

    // Pre-check model availability
    const hasLMStudioModel = getModelIdForApp(modelToUse.id) !== null;
    const hasGroqModel = getGroqModelIdForApp(modelToUse.id) !== null;
    
    // Route to appropriate handler with image support
    if (hasLMStudioModel) {
      await callLocalModelAPI(submittedPrompt, modelToUse.id, images);
    } else if (hasGroqModel) {
      await callGroqAPI(submittedPrompt, modelToUse.id, images);
    } else {
      await handleMockResponse(submittedPrompt, modelToUse.name, images);
    }
  }, [selectedModel, models, selectedModelIndex, resetResponseState, callLocalModelAPI, callGroqAPI, handleMockResponse, saveData]);

  // Optimized drag handler
  const handleDragEnd = useCallback((event: any) => {
    const {active, over} = event;
    if (!active || !over || active.id === over.id) return;

    setModels((items) => {
      const oldIndex = items.findIndex(item => item.id === active.id);
      const newIndex = items.findIndex(item => item.id === over.id);
      
      if (oldIndex === -1 || newIndex === -1) return items;
      
      const selectedModelId = items[selectedModelIndex].id;
      const newItems = arrayMove(items, oldIndex, newIndex);
      const newSelectedIndex = newItems.findIndex(item => item.id === selectedModelId);
      
      setSelectedModelIndex(newSelectedIndex);
      saveData('order', newItems);
      
      return newItems;
    });
  }, [selectedModelIndex, saveData]);

  return (
    <div className="app-container" ref={appContainerRef}>
      <header className="app-header">
        <PromptInput onSubmit={handlePromptSubmit} onImageDetected={handleImageDetected} />
      </header>
      <main className="app-main">
        <ResponseView 
          isLoading={isLoading}
          response={response}
          prompt={prompt}
          thinkingContent={thinkingContent}
          isThinking={isThinking}
          sources={sources}
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
