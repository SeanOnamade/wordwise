'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { useEditorStore } from '@/store/editorStore';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';

interface ExportButtonProps {
  className?: string;
  editor?: any; // TipTap editor instance
}

export default function ExportButton({ className, editor }: ExportButtonProps) {
  const { currentDoc } = useEditorStore();
  const { trackExport } = usePerformanceMonitor();
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Debug component mount/unmount
  useEffect(() => {
    console.log('🔄 ExportButton component mounted');
    return () => {
      console.log('🔄 ExportButton component unmounted');
    };
  }, []);

  // Debug state changes
  useEffect(() => {
    console.log('🔄 ExportButton state changed:', {
      showDropdown,
      isExporting,
      hasEditor: !!editor,
      hasCurrentDoc: !!currentDoc,
      dropdownPosition
    });
  }, [showDropdown, isExporting, editor, currentDoc, dropdownPosition]);

  const exportFormats = [
    {
      id: 'pdf',
      label: 'Export as PDF',
      description: 'High-quality PDF with formatting preserved',
      icon: '📄',
      color: 'from-red-500 to-red-600'
    },
    {
      id: 'docx',
      label: 'Export as DOCX',
      description: 'Microsoft Word document with full formatting',
      icon: '📝',
      color: 'from-blue-500 to-blue-600'
    },
    {
      id: 'txt',
      label: 'Export as TXT',
      description: 'Plain text file without formatting',
      icon: '📋',
      color: 'from-gray-500 to-gray-600'
    }
  ];

  // Calculate dropdown position when showing
  useEffect(() => {
    if (showDropdown && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const newPosition = {
        top: rect.bottom + window.scrollY + 8,
        left: rect.right + window.scrollX - 256 // 256px is dropdown width
      };
      
      console.log('📍 Calculating dropdown position:', {
        showDropdown,
        buttonRect: rect,
        windowScroll: { x: window.scrollX, y: window.scrollY },
        newPosition
      });
      
      setDropdownPosition(newPosition);
    }
  }, [showDropdown]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      console.log('🖱️ Click outside detected:', {
        showDropdown,
        target: event.target,
        buttonContains: buttonRef.current?.contains(target),
        isDropdownContent: target && (target as Element).closest?.('[data-dropdown-content]')
      });
      
      if (showDropdown && buttonRef.current && !buttonRef.current.contains(target)) {
        // Check if the click is inside the dropdown content
        const dropdownContent = document.querySelector('[data-dropdown-content]');
        if (dropdownContent && dropdownContent.contains(target)) {
          console.log('🖱️ Click is inside dropdown content, not closing');
          return;
        }
        
        console.log('🖱️ Closing dropdown due to outside click');
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      console.log('🖱️ Adding click outside listener');
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        console.log('🖱️ Removing click outside listener');
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showDropdown]);

  // Clear error after 5 seconds
  useEffect(() => {
    if (exportError) {
      const timer = setTimeout(() => setExportError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [exportError]);

  const exportDocument = async (format: 'pdf' | 'docx' | 'txt') => {
    if (!editor || !currentDoc) {
      console.error('❌ Export failed: Editor or document not ready', { editor: !!editor, currentDoc: !!currentDoc });
      setExportError('Editor not ready');
      return;
    }

    // Get editor content
    let content;
    try {
      content = editor.getHTML();
      console.log('📝 Getting editor content:', { 
        hasContent: !!content,
        length: content?.length,
        editor: {
          isEditable: editor.isEditable,
          isActive: editor.isActive,
          state: editor.state ? 'exists' : 'missing'
        }
      });
    } catch (error) {
      console.error('❌ Failed to get editor content:', error);
      setExportError('Failed to get document content');
      return;
    }
    
    if (!content) {
      setExportError('No document content to export');
      return;
    }

    setIsExporting(true);
    setExportError(null);
    setShowDropdown(false);

    const startTime = performance.now();

    try {
      console.log(`🚀 Starting ${format.toUpperCase()} export...`);
      
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          title: currentDoc.title || 'Untitled Document',
          format,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Export failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentDoc.title || 'document'}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      // Track successful export
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      
      console.log(`✅ ${format.toUpperCase()} export completed in ${duration}ms (${Math.round(blob.size / 1024)}KB)`);
      
      trackExport({
        format,
        duration,
        fileSize: blob.size,
        success: true
      });

    } catch (error) {
      console.error('❌ Export failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Export failed';
      setExportError(errorMessage);

      // Track failed export
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      
      trackExport({
        format,
        duration,
        fileSize: 0,
        success: false,
        error: errorMessage
      });
    } finally {
      setIsExporting(false);
    }
  };

  const DropdownContent = () => (
    <div 
      data-dropdown-content
      className="fixed w-64 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
      style={{
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        zIndex: 9999
      }}
    >
      <div className="p-2">
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 px-3 py-2 border-b border-slate-100 dark:border-slate-700">
          Choose Export Format
        </div>
        {exportFormats.map((format) => (
          <button
            key={format.id}
            onClick={(e) => {
              console.log('🖱️ Export button clicked:', format.id);
              console.log('🖱️ Event details:', {
                target: e.target,
                currentTarget: e.currentTarget,
                button: e.button,
                bubbles: e.bubbles,
                defaultPrevented: e.defaultPrevented
              });
              console.log('🖱️ Component state:', {
                isExporting,
                hasEditor: !!editor,
                hasCurrentDoc: !!currentDoc,
                showDropdown
              });
              
              e.preventDefault();
              e.stopPropagation();
              
              try {
                exportDocument(format.id as 'pdf' | 'docx' | 'txt');
              } catch (error) {
                console.error('🖱️ Error calling exportDocument:', error);
              }
            }}
            disabled={isExporting}
            className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className={`flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br ${format.color} flex items-center justify-center text-white text-sm font-medium shadow-sm`}>
              {format.icon}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="font-medium text-slate-900 dark:text-white text-sm">
                {format.label}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {format.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <div className={`relative ${className}`}>
        <Button
          ref={buttonRef}
          onClick={(e) => {
            console.log('🖱️ Main Export button clicked');
            console.log('🖱️ Current state:', {
              showDropdown,
              isExporting,
              hasEditor: !!editor,
              hasCurrentDoc: !!currentDoc,
              editorState: editor ? {
                isEditable: editor.isEditable,
                isActive: editor.isActive,
                hasState: !!editor.state
              } : null
            });
            
            setShowDropdown(!showDropdown);
          }}
          disabled={isExporting || !editor}
          size="lg"
          variant="secondary"
          className="flex items-center gap-2 font-medium hover:scale-105 transition-transform"
        >
          {isExporting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
              <span>Exporting...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Export</span>
              <svg className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </>
          )}
        </Button>

        {exportError && (
          <div className="absolute top-full right-0 mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400 max-w-xs shadow-lg">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div className="font-medium">Export Failed</div>
                <div className="text-xs mt-1 opacity-90">{exportError}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Render dropdown using portal to avoid z-index issues */}
      {showDropdown && !isExporting && typeof window !== 'undefined' && (() => {
        console.log('🚪 Rendering dropdown portal:', {
          showDropdown,
          isExporting,
          windowExists: typeof window !== 'undefined',
          dropdownPosition,
          bodyExists: !!document.body
        });
        
        return createPortal(<DropdownContent />, document.body);
      })()}
    </>
  );
} 