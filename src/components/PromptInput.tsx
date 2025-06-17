import React, { useState, useRef, useEffect } from 'react';
import './PromptInput.css';
import { MemoryService } from '../services/memoryService';

interface PromptInputProps {
  onSubmit: (prompt: string, images?: Array<{ data: string; type: string }>) => void;
  onImageDetected?: () => void;
}

const PromptInput: React.FC<PromptInputProps> = ({ onSubmit, onImageDetected }) => {
  const [prompt, setPrompt] = useState('');
  const [contextSummary, setContextSummary] = useState<string>('');
  const [images, setImages] = useState<Array<{ data: string; type: string; id: string }>>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Listen for focus events from the main process
    const cleanup = window.electronAPI.onFocusInput(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    });

    // Update context summary periodically
    const updateContextSummary = () => {
      setContextSummary(MemoryService.getContextSummary());
    };
    
    updateContextSummary();
    const interval = setInterval(updateContextSummary, 1000);

    return () => {
      cleanup();
      clearInterval(interval);
    };
  }, []);

  // Handle paste events for images
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // Only handle paste if the input is focused
      if (document.activeElement !== inputRef.current) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = () => {
              const imageData = reader.result as string;
              const newImage = {
                id: Date.now().toString(),
                data: imageData,
                type: file.type
              };
              setImages(prev => [...prev, newImage]);
              
              // Notify parent component that an image was detected
              if (onImageDetected) {
                onImageDetected();
              }
            };
            reader.readAsDataURL(file);
          }
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [onImageDetected]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() || images.length > 0) {
      onSubmit(prompt.trim(), images.length > 0 ? images.map(img => ({ data: img.data, type: img.type })) : undefined);
      setPrompt('');
      setImages([]);
    }
  };

  const removeImage = (imageId: string) => {
    setImages(prev => prev.filter(img => img.id !== imageId));
  };

  return (
    <div className="prompt-container">
      <div className="actions-header">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="actions-icon">
          <path d="M16.2361 3.23607C17.9941 1.47807 20.806 1.47807 22.564 3.23607C24.322 4.99407 24.322 7.8059 22.564 9.5639L21.8569 10.271L13.5279 1.9421L16.2361 3.23607Z" fill="currentColor"/>
          <path d="M12.1137 3.35626L2.92182 12.5482C2.33601 13.134 2.0431 13.4269 1.82138 13.7818C1.6267 14.0903 1.47807 14.4343 1.3815 14.7942C1.2719 15.2002 1.2719 15.6323 1.2719 16.4965V20.7281C1.2719 21.8327 2.16731 22.7281 3.2719 22.7281H7.50352C8.36772 22.7281 8.79982 22.7281 9.20584 22.6185C9.56573 22.5219 9.90972 22.3733 10.2182 22.1786C10.5731 21.9569 10.866 21.664 11.4518 21.0782L20.6437 11.8863L12.1137 3.35626Z" fill="currentColor"/>
        </svg>
        <span className="actions-label">TeliChat</span>
        {contextSummary && contextSummary !== 'No conversation history' && (
          <span className="context-indicator" title="Conversation memory active">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1V3H9V1L3 7V9H1V11H3L5 19H19L21 11H23V9H21Z" fill="currentColor"/>
            </svg>
            {contextSummary}
          </span>
        )}
      </div>
      <form onSubmit={handleSubmit} className="prompt-form">
        {images.length > 0 && (
          <div className="image-preview-container">
            {images.map((image) => (
              <div key={image.id} className="image-preview">
                <img src={image.data} alt="Pasted image" />
                <button
                  type="button"
                  className="remove-image-button"
                  onClick={() => removeImage(image.id)}
                  title="Remove image"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="input-wrapper">
          <input
            ref={inputRef}
            type="text"
            className="prompt-input"
            placeholder={images.length > 0 ? "Describe your image or ask about it..." : "Ask me anything..."}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <button
            type="submit"
            className="submit-button"
            disabled={!prompt.trim() && images.length === 0}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 21L16.514 16.506L21 21ZM19 10.5C19 15.194 15.194 19 10.5 19C5.806 19 2 15.194 2 10.5C2 5.806 5.806 2 10.5 2C15.194 2 19 5.806 19 10.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        {images.length > 0 && (
          <div className="image-info">
            <span className="image-count">{images.length} image{images.length !== 1 ? 's' : ''} • Model changed to LLama to support image analysis</span>
          </div>
        )}
      </form>
    </div>
  );
};

export default PromptInput; 