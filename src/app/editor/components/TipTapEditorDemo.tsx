/* @ts-nocheck */
'use client';

import { useState } from 'react';
import TipTapEditor from './TipTapEditor';

// Mock suggestions for testing
const mockSuggestions = [
  {
    id: '1',
    original: 'teh',
    replacement: 'the',
    type: 'spelling' as const,
    range: { from: 0, to: 3 },
    status: 'pending' as const,
    explanation: 'Spelling correction',
    ruleKey: 'DEMO',
    replacements: ['the']
  },
  {
    id: '2', 
    original: 'realy',
    replacement: 'really',
    type: 'spelling' as const,
    range: { from: 10, to: 15 },
    status: 'pending' as const,
    explanation: 'Improve fluency',
    ruleKey: 'DEMO',
    replacements: ['really']
  },
  {
    id: '3',
    original: 'amazing',
    replacement: 'excellent',
    type: 'style' as const,
    range: { from: 20, to: 27 },
    status: 'pending' as const, 
    explanation: 'Better tone for academic writing',
    ruleKey: 'DEMO',
    replacements: ['excellent']
  }
];

export default function TipTapEditorDemo() {
  const [content, setContent] = useState('teh text is realy amazing and works well');
  const [suggestions, setSuggestions] = useState(mockSuggestions);

  const handleApplySuggestion = (suggestionId: string) => {
    setSuggestions(prev => 
      prev.map(s => 
        s.id === suggestionId 
          ? { ...s, status: 'accepted' }
          : s
      )
    );
  };

  const handleDismissSuggestion = (suggestionId: string) => {
    setSuggestions(prev => 
      prev.map(s => 
        s.id === suggestionId 
          ? { ...s, status: 'rejected' }
          : s
      )
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">TipTap Editor with Inline Highlighting</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor */}
        <div className="lg:col-span-2">
          <TipTapEditor
            content={content}
            suggestions={suggestions}
            onUpdate={setContent}
          />
        </div>
        
        {/* Suggestions Panel */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Suggestions</h2>
          {suggestions.filter(s => s.status === 'pending').map(suggestion => (
            <div key={suggestion.id} className="p-4 border rounded-lg bg-white shadow">
              <div className={`inline-block px-2 py-1 rounded text-xs mb-2 ${
                suggestion.type === 'grammar' ? 'bg-red-100 text-red-800' :
                suggestion.type === 'fluency' ? 'bg-blue-100 text-blue-800' :
                'bg-green-100 text-green-800'
              }`}>
                {suggestion.type}
              </div>
              
              <p className="font-medium text-red-600 mb-1">
                "{suggestion.original}"
              </p>
              <p className="font-medium text-green-600 mb-2">
                → "{suggestion.replacement}"
              </p>
              <p className="text-sm text-gray-600 mb-3">
                {suggestion.explanation}
              </p>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => handleApplySuggestion(suggestion.id)}
                  className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                >
                  Apply
                </button>
                <button
                  onClick={() => handleDismissSuggestion(suggestion.id)}
                  className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
          
          {suggestions.filter(s => s.status === 'pending').length === 0 && (
            <p className="text-gray-500 text-center py-8">No pending suggestions</p>
          )}
        </div>
      </div>
      
      {/* Debug Info */}
      <div className="mt-8 p-4 bg-gray-100 rounded">
        <h3 className="font-semibold mb-2">Debug Info:</h3>
        <p><strong>Content:</strong> {content}</p>
        <p><strong>Pending Suggestions:</strong> {suggestions.filter(s => s.status === 'pending').length}</p>
      </div>
    </div>
  );
} 