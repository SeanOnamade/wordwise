'use client';

import { useState, useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { auth } from '@/lib/firebase';
import Sidebar from './components/Sidebar';
import SuggestionDrawer from './components/SuggestionDrawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import TipTapEditor from './components/TipTapEditor';
import { useAutosave } from '@/hooks/useAutosave';

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
  const [isLoading, setIsLoading] = useState(false);

  // Integrate improved autosave
  const { lastSaved, isSaving, error: saveError } = useAutosave({
    docId: currentDoc?.id || '',
    content: currentDoc?.content || '',
    title: currentDoc?.title || 'Untitled Document',
    enabled: !!auth?.currentUser && !!currentDoc?.id
  });

  const handleContentChange = (content: string) => {
    if (currentDoc) {
      console.log('📝 Content updated:', {
        docId: currentDoc.id,
        contentLength: content.length
      });
      
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
  };

  const handleTitleChange = (title: string) => {
    if (currentDoc) {
      console.log('📝 Title updated:', {
        docId: currentDoc.id,
        title
      });
      
      const updatedDoc = {
        ...currentDoc,
        title,
        lastModified: new Date()
      };
      updateDocument(updatedDoc);
    }
  };

  const handleExport = async () => {
    if (!currentDoc?.content) return;
    
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: currentDoc.content,
          title: currentDoc.title || 'Untitled Document',
          format: 'pdf'
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentDoc.title || 'document'}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Export failed:', error);
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
              <span className="text-sm text-slate-400">
                {isSaving ? 'Saving...' : lastSaved ? `Last saved ${formatLastUpdated(lastSaved)}` : 'Not saved yet'}
              </span>
              {saveError && (
                <span className="text-sm text-red-400">
                  Save error: {saveError}
                </span>
              )}
              <Badge variant="secondary" className="text-xs bg-white/10 text-slate-300 border-white/20">
                {user?.email || 'Anonymous'}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Performance metrics moved to toolbar */}
            <div className="flex items-center space-x-2 text-xs text-slate-400">
              <span>{wordCount} words</span>
              {performanceMetrics.totalChecks > 0 && (
                <span>• {performanceMetrics.lastResponseTime}ms</span>
              )}
              {isLoading && (
                <span className="text-indigo-400">• Checking grammar...</span>
              )}
            </div>
            
            <Button 
              variant="default" 
              size="sm" 
              className="bg-indigo-400 hover:bg-indigo-500 disabled:opacity-50"
              onClick={handleExport}
            >
              Export
            </Button>
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
              />
            </div>
          </div>

          {/* Suggestions Drawer */}
          <div className="w-80 border-l border-white/10">
            <SuggestionDrawer editor={editorInstance} />
          </div>
        </div>
      </div>
    </div>
  );
} 