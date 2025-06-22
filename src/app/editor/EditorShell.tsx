'use client';

import { useState, useEffect, useCallback } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { auth } from '@/lib/firebase';
import Sidebar from './components/Sidebar';
import SuggestionDrawer from './components/SuggestionDrawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import TipTapEditor from './components/TipTapEditor';
import { useAutosave } from '@/hooks/useAutosave';
import CopyHTMLButton from '@/components/ShareButton';
import ExportButton from '@/components/ExportButton';
import { checkText } from '@/lib/grammar';

interface EditorShellProps {
  user: any;
  onSignOut: () => void;
}

export default function EditorShell({ user, onSignOut }: EditorShellProps) {
  const { 
    currentDoc, 
    setCurrentDoc,
    updateDocument,
    suggestions, 
    wordCount, 
    performanceMetrics, 
    addSuggestion, 
    clearSuggestions, 
    setWordCount, 
    updatePerformanceMetrics 
  } = useEditorStore();
  
  const [editorInstance, setEditorInstance] = useState<any>(null);
  const [isGrammarChecking, setIsGrammarChecking] = useState(false);

  // Debug logging for editor instance changes
  useEffect(() => {
    console.log('🔄 Editor instance updated:', {
      hasInstance: !!editorInstance,
      instanceState: editorInstance ? {
        isEditable: editorInstance.isEditable,
        isActive: editorInstance.isActive,
        hasState: !!editorInstance.state
      } : null
    });
  }, [editorInstance]);

  // Integrate improved autosave
  const { lastSaved, isSaving, error: saveError, forceSave } = useAutosave({
    docId: currentDoc?.id || '',
    content: currentDoc?.content || '',
    title: currentDoc?.title || 'Untitled Document',
    createdAt: currentDoc?.createdAt || null,
    enabled: !!auth?.currentUser && !!currentDoc?.id
  });

  const handleSuggestionApplied = useCallback(async () => {
    if (!editorInstance) {
      console.error("Cannot save after suggestion, editor instance not available.");
      return;
    }
    
    // The editor content is updated synchronously by tiptap,
    // so we can get the latest HTML right away.
    const latestContent = editorInstance.getHTML();
    const latestTitle = currentDoc?.title || 'Untitled Document';
    
    console.log('📝 Triggering save with latest content after suggestion.', { length: latestContent.length });

    // Also update the Zustand store so the hook's own `content` state 
    // is up-to-date for the next regular, debounced save.
    if (currentDoc) {
      updateDocument({ ...currentDoc, content: latestContent, title: latestTitle });
    }

    await forceSave({ content: latestContent, title: latestTitle });
  }, [editorInstance, forceSave, currentDoc, updateDocument]);

  const handleContentChange = (content: string) => {
    if (currentDoc) {
      const updatedDoc = {
        ...currentDoc,
        content,
        lastModified: new Date()
      };
      updateDocument(updatedDoc);
    }
  };

  const handleTextChange = (text: string) => {
    // Calculate word count
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    setWordCount(words.length);

    // Debounced grammar check
    const check = async () => {
      if (!editorInstance) return;
      
      const plainText = editorInstance.getText();
      if (plainText.trim().length < 10) {
        clearSuggestions();
        return;
      }
      
      setIsGrammarChecking(true);
      const suggestions = await checkText(plainText);
      useEditorStore.setState({ suggestions });
      setIsGrammarChecking(false);
    };

    check();
  };

  const handleGrammarCheck = useCallback(async () => {
    if (!editorInstance) return;
    setIsGrammarChecking(true);
    const text = editorInstance.getText();
    const newSuggestions = await checkText(text);
    useEditorStore.setState({ suggestions: newSuggestions });
    setIsGrammarChecking(false);
  }, [editorInstance]);

  const handleTitleChange = (title: string) => {
    if (currentDoc) {
      const updatedDoc = {
        ...currentDoc,
        title,
        lastModified: new Date()
      };
      updateDocument(updatedDoc);
    }
  };

  const formatLastUpdated = (date: Date | null) => {
    if (!date) return 'Never';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    return date.toLocaleDateString();
  };

  if (!currentDoc) {
    return (
      <div className="h-screen flex">
        <Sidebar />
        <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 text-white">
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-2">Welcome to WordWise</h2>
            <p className="text-slate-400 mb-6">Create a new document to get started.</p>
            <Button onClick={useEditorStore.getState().createNewDocument} size="lg">
              Start Writing
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col bg-gradient-to-br from-slate-900 to-slate-800">
        {/* Editor Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white/5 backdrop-blur-md border-b border-white/10">
          <div className="flex-1">
            <input
              type="text"
              value={currentDoc?.title || ''}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="text-2xl font-bold bg-transparent border-none focus:outline-none focus:ring-0 placeholder-slate-400 text-slate-100 w-full"
              placeholder="Untitled Document"
            />
            <div className="flex items-center space-x-4 mt-1">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-slate-400">
                  {isSaving ? 'Saving...' : lastSaved ? `Last saved ${formatLastUpdated(lastSaved)}` : 'Not saved yet'}
                </span>
                {isSaving && (
                  <svg className="animate-spin h-4 w-4 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
              </div>
              {saveError && (
                <span className="text-sm text-red-400">
                  Save error: {saveError}
                </span>
              )}
              <Badge variant="secondary" className="text-xs bg-white/10 text-slate-300 border-white/20">
                {user?.email || 'Anonymous'}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={onSignOut}
                className="text-slate-300 hover:text-white border-slate-500 hover:border-slate-400"
              >
                Sign Out
              </Button>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Performance metrics moved to toolbar */}
            <div className="flex items-center space-x-2 text-xs text-slate-400">
              <span>{wordCount} words</span>
              {performanceMetrics.totalChecks > 0 && (
                <span>• {performanceMetrics.lastResponseTime}ms</span>
              )}
              {isGrammarChecking && (
                <div className="flex items-center text-indigo-400">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Checking grammar...
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                onClick={handleGrammarCheck}
                disabled={isGrammarChecking}
                variant="outline"
                className="text-slate-300 hover:text-white border-slate-500 hover:border-slate-400"
              >
                {isGrammarChecking ? 'Checking...' : 'Check Grammar'}
              </Button>
              <CopyHTMLButton 
                editor={editorInstance} 
                className="text-black"
              />
              
              <ExportButton editor={editorInstance} />
            </div>
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 flex">
          <div className="flex-1 overflow-auto">
            <div className="max-w-4xl mx-auto">
              <TipTapEditor
                content={currentDoc?.content || ''}
                suggestions={suggestions}
                onUpdate={handleContentChange}
                onTextChange={handleTextChange}
                onEditorCreate={setEditorInstance}
                onGrammarCheckStart={() => setIsGrammarChecking(true)}
                onGrammarCheckEnd={() => setIsGrammarChecking(false)}
                onSuggestionApplied={handleSuggestionApplied}
              />
            </div>
          </div>

          {/* Suggestions Drawer */}
          <div className="w-80 border-l border-white/10">
            <SuggestionDrawer 
              editor={editorInstance} 
              isLoading={isGrammarChecking}
              onSuggestionApplied={handleSuggestionApplied}
            />
          </div>
        </div>
      </div>
    </div>
  );
} 