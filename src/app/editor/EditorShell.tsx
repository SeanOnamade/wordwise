'use client';

import { useState, useEffect, useCallback } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { auth } from '@/lib/firebase';
import Sidebar from './components/Sidebar';
import SuggestionDrawer from './components/SuggestionDrawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import TipTapEditor from './components/TipTapEditor';

interface EditorShellProps {
  user: any;
  onSignOut: () => void;
}

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export default function EditorShell({ user, onSignOut }: EditorShellProps) {
  const { currentDoc, setCurrentDoc, suggestions, wordCount, performanceMetrics, addSuggestion, clearSuggestions, setWordCount, updatePerformanceMetrics } = useEditorStore();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [editorInstance, setEditorInstance] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Mock documents for dropdown
  const documents = [
    { id: '1', title: 'Current Document' },
    { id: '2', title: 'Academic Essay' },
    { id: '3', title: 'Research Notes' }
  ];

  // Auto-save hook - debounce 3s
  useEffect(() => {
    if (!currentDoc) return;
    
    const saveTimer = setTimeout(() => {
      // Auto-save logic here
      setLastUpdated(new Date());
      setHasChanges(false);
    }, 3000);

    return () => clearTimeout(saveTimer);
  }, [currentDoc?.content]);

  const handleContentChange = (content: string) => {
    if (currentDoc) {
      setCurrentDoc({
        ...currentDoc,
        content
      });
      setHasChanges(true);
    }
  };

  const handleTextChange = (text: string) => {
    // Calculate word count
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    setWordCount(words.length);
    
    // Trigger grammar check
    debouncedGrammarCheck(text);
  };

  const handleTitleChange = (title: string) => {
    if (currentDoc) {
      setCurrentDoc({
        ...currentDoc,
        title
      });
      setHasChanges(true);
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
    
    const days = Math.floor(hours / 24);
    return date.toLocaleDateString();
  };

  // 40-word rule tooltip functionality
  const checkSentenceLength = useCallback((text: string) => {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const longSentences: Array<{
      sentence: string;
      wordCount: number;
      start: number;
      end: number;
    }> = [];
    
    let currentPos = 0;
    sentences.forEach(sentence => {
      const trimmedSentence = sentence.trim();
      if (trimmedSentence.length > 0) {
        const words = trimmedSentence.split(/\s+/).filter(w => w.length > 0);
        if (words.length > 40) {
          const start = text.indexOf(trimmedSentence, currentPos);
          const end = start + trimmedSentence.length;
          longSentences.push({
            sentence: trimmedSentence,
            wordCount: words.length,
            start,
            end
          });
        }
        currentPos += trimmedSentence.length;
      }
    });
    
    return longSentences;
  }, []);

  // Enhanced grammar checking with 40-word rule
  const debouncedGrammarCheck = useCallback(
    debounce(async (text: string) => {
      if (text.length < 3) return; // Don't check very short text
      
      const startTime = Date.now();
      console.log('Grammar checking text:', text); // Debug log
      setIsLoading(true);
      
      try {
        // Check for 40-word rule violations first
        const longSentences = checkSentenceLength(text);
        
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text }),
        });
        
        if (response.ok) {
          const data = await response.json();
          const responseTime = Date.now() - startTime;
          
          // Track performance metrics
          updatePerformanceMetrics(responseTime);
          
          console.log(`📊 Performance: ${responseTime}ms response time`);
          console.log('Grammar check response:', data); // Debug log
          console.log('Number of suggestions received:', data.suggestions?.length || 0); // Debug log
          
          clearSuggestions();
          
          // Add 40-word rule suggestions first
          longSentences.forEach((longSentence, index) => {
            const suggestion = {
              range: { from: longSentence.start, to: longSentence.end },
              type: 'style' as const,
              original: longSentence.sentence.substring(0, 50) + (longSentence.sentence.length > 50 ? '...' : ''),
              replacement: '',
              ruleKey: 'LONG_SENTENCE',
              explanation: `📏 Long sentence detected: ${longSentence.wordCount} words. Academic writing is more effective with sentences under 40 words. Consider breaking this into shorter, clearer sentences for better readability.`
            };
            addSuggestion(suggestion);
          });
          
          // Add suggestions from grammar checker
          data.suggestions.forEach((suggestion: any, index: number) => {
            console.log('Adding suggestion:', suggestion); // Debug log
            const suggestionWithId = {
              ...suggestion,
              id: crypto.randomUUID()
            };
            addSuggestion(suggestionWithId);
            
            console.log('🚀 Suggestion added:', suggestionWithId.original);
          });
          
          // Performance alert if too slow
          if (responseTime > 2000) {
            console.warn('⚠️ Response time exceeded 2 seconds:', responseTime + 'ms');
          }
        }
      } catch (error) {
        console.error('Grammar check failed:', error);
        const responseTime = Date.now() - startTime;
        console.error('Failed after:', responseTime + 'ms');
      } finally {
        setIsLoading(false);
      }
    }, 1000), // 1-second debounce for responsive typing
    [addSuggestion, clearSuggestions, checkSentenceLength, updatePerformanceMetrics]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A1224] via-[#1C2450] to-[#1B1B33]">
      {/* Mobile Sidebar - Hidden on md+ */}
      <div className="md:hidden">
        <Sidebar />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-[1fr_340px] h-screen">
        {/* Main Editor Area */}
        <div className="flex flex-col">
          {/* Navigation Bar with Document Dropdown */}
          <nav className="flex justify-between items-center px-6 py-4 bg-white/5 backdrop-blur-md border-b border-white/10">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-indigo-400 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">✨</span>
                </div>
                <h1 className="text-xl font-bold text-indigo-400">WordWise</h1>
              </div>
              
              {/* Document Dropdown - Hidden on mobile, shown on md+ */}
              <div className="hidden md:block">
                <select 
                  value={currentDoc?.id || ''}
                  onChange={(e) => {
                    const doc = documents.find(d => d.id === e.target.value);
                    if (doc) {
                      setCurrentDoc({
                        id: doc.id,
                        title: doc.title,
                        content: currentDoc?.content || ''
                      });
                    }
                  }}
                  className="bg-white/10 border-transparent rounded-lg px-3 py-1 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/50 backdrop-blur-sm"
                >
                  {documents.map(doc => (
                    <option key={doc.id} value={doc.id} className="bg-slate-800 text-slate-200">
                      {doc.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-slate-300">Signed in as {user?.email}</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onSignOut}
                className="border-white/20 text-slate-300 hover:bg-white/10 hover:text-white backdrop-blur-sm"
              >
                Sign Out
              </Button>
            </div>
          </nav>

          {/* Document Toolbar */}
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
                  Last updated: {formatLastUpdated(lastUpdated)}
                </span>
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
                disabled={!hasChanges}
                className="bg-indigo-400 hover:bg-indigo-500 disabled:opacity-50"
                onClick={handleExport}
              >
                Export
              </Button>
            </div>
          </div>

          {/* Editor Area */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto px-6 py-8">
              <div className="bg-white/5 backdrop-blur-md border border-white/10 shadow-lg rounded-2xl overflow-hidden">
                <div className="prose prose-lg max-w-none p-6 bg-slate-50 text-slate-900 rounded-2xl editor-light-canvas">
                  <TipTapEditor 
                    content={currentDoc?.content || ''}
                    suggestions={suggestions}
                    onUpdate={handleContentChange}
                    onTextChange={handleTextChange}
                    onEditorCreate={setEditorInstance}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Suggestion Drawer - Bottom sheet on mobile, glass panel on desktop */}
        <div className="fixed bottom-0 inset-x-0 h-1/2 md:static md:h-screen md:w-auto rounded-t-3xl md:rounded-none bg-slate-900/90 md:bg-white/5 backdrop-blur-md border-t md:border-l border-white/10 shadow-lg">
          <SuggestionDrawer editor={editorInstance} />
        </div>
      </div>
    </div>
  );
} 