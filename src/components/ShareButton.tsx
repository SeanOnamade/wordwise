'use client';

import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Editor } from '@tiptap/react';

interface CopyHTMLButtonProps {
  editor: Editor | null;
  className?: string;
}

export default function CopyHTMLButton({ editor, className = '' }: CopyHTMLButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyAsHTML = async () => {
    if (!editor) return;

    try {
      // Get the current document content as HTML
      const htmlContent = editor.getHTML();
      
      // Clean up the HTML for better compatibility with external tools
      const cleanedHTML = htmlContent
        .replace(/<mark[^>]*data-suggestion-id[^>]*>(.*?)<\/mark>/g, '$1') // Remove suggestion highlights
        .replace(/class="[^"]*"/g, '') // Remove CSS classes
        .replace(/style="[^"]*"/g, '') // Remove inline styles
        .replace(/<(\w+)[^>]*>/g, '<$1>') // Simplify tags
        .trim();

      // Copy to clipboard
      await navigator.clipboard.writeText(cleanedHTML);
      
      setCopied(true);
      
      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setCopied(false);
      }, 2000);
      
      console.log('📋 Document HTML copied to clipboard');
      
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      
      // Fallback: show alert with the HTML
      const htmlContent = editor.getHTML();
      const cleanedHTML = htmlContent
        .replace(/<mark[^>]*data-suggestion-id[^>]*>(.*?)<\/mark>/g, '$1')
        .replace(/class="[^"]*"/g, '')
        .replace(/style="[^"]*"/g, '')
        .trim();
      
      alert('Copy this HTML for use in other applications:\n\n' + cleanedHTML);
    }
  };

  return (
    <Button
      onClick={handleCopyAsHTML}
      disabled={!editor}
      variant="outline"
      size="sm"
      className={`${className} ${copied ? 'bg-green-50 text-green-700 border-green-200' : ''}`}
      title="Copy document as clean HTML to clipboard"
      aria-label="Copy document content as HTML to clipboard for use in other applications"
    >
      {copied ? (
        <>
          <span className="mr-2">✓</span>
          Copied!
        </>
      ) : (
        <>
          <span className="mr-2">📋</span>
          Copy as HTML
        </>
      )}
    </Button>
  );
} 