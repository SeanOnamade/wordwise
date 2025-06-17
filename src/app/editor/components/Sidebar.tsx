'use client';

import { useState, useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { Button } from '@/components/ui/button';

interface Document {
  id: string;
  title: string;
  content: string;
  lastModified?: Date;
  createdAt?: Date;
}

export default function Sidebar() {
  const { currentDoc, setCurrentDoc } = useEditorStore();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Initialize with a default document if none exists
  useEffect(() => {
    if (!currentDoc) {
      const defaultDoc: Document = {
        id: '1',
        title: 'Current Document',
        content: 'This is a sample document with some text that might have grammer mistakes and very long sentences that exceed the forty word limit which is designed to help students write more clearly and concisely for better academic writing results.',
        lastModified: new Date(),
        createdAt: new Date(),
      };
      setCurrentDoc(defaultDoc);
    }
  }, [currentDoc, setCurrentDoc]);

  const formatDate = (date: Date | undefined) => {
    if (!date) return '';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="h-full flex flex-col bg-slate-900 shadow-[0_0_0_1px_#1d2a47]">
      {/* Sidebar Header with WordWise Logo */}
      <div className="p-4 shadow-[0_0_0_1px_#1d2a47]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-indigo-400 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">✨</span>
            </div>
            <span className="text-lg font-bold text-indigo-400">WordWise</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-8 w-8 p-0 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg 
              className={`w-4 h-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M15 19l-7-7 7-7" 
              />
            </svg>
          </Button>
        </div>
      </div>

      {/* Current Document Display */}
      {!isCollapsed && (
        <>
          <div className="flex-1 p-4">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-2">
                Current Document
              </h3>
            </div>
            
            {currentDoc && (
              <div className="bg-indigo-600/20 text-indigo-300 border border-indigo-600/30 rounded-lg p-3 shadow-sm">
                <div className="flex flex-col space-y-2">
                  <h4 className="font-medium text-sm truncate">
                    {currentDoc.title}
                  </h4>
                  <p className="text-xs text-slate-400 line-clamp-3">
                    {currentDoc.content.substring(0, 100)}...
                  </p>
                                     <span className="text-xs text-slate-500">
                     Last updated: {formatDate(new Date())}
                   </span>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Footer */}
          <div className="p-4 shadow-[0_0_0_1px_#1d2a47]">
            <div className="text-xs text-slate-400">
              Document ready for editing
            </div>
          </div>
        </>
      )}
    </div>
  );
} 