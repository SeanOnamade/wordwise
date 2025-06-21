import { useEffect, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { isMacOS } from '@/lib/utils';
import { Level } from '@tiptap/extension-heading';

interface KeyboardShortcutsProps {
  editor: Editor | null;
  onSave?: () => void;
}

export function useKeyboardShortcuts({ editor, onSave }: KeyboardShortcutsProps) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!editor) return;

    // Check if we're using Mac
    const isMac = isMacOS();
    const modKey = isMac ? event.metaKey : event.ctrlKey;

    // Don't handle shortcuts if user is typing in an input field
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }

    // Save - Ctrl/Cmd + S
    if (modKey && event.key === 's') {
      event.preventDefault();
      onSave?.();
      return;
    }
  }, [editor, onSave]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Return shortcut info for tooltips
  return {
    getShortcutLabel: (command: string): string => {
      const mod = isMacOS() ? '⌘' : 'Ctrl';
      const alt = isMacOS() ? '⌥' : 'Alt';
      const shift = isMacOS() ? '⇧' : 'Shift';

      // TipTap's default shortcuts
      const shortcuts: Record<string, string> = {
        bold: `${mod}+B`,
        italic: `${mod}+I`,
        underline: `${mod}+U`,
        strike: `${mod}+${shift}+X`,
        highlight: `${mod}+${shift}+H`,
        h1: `${mod}+${alt}+1`,
        h2: `${mod}+${alt}+2`,
        h3: `${mod}+${alt}+3`,
        bulletList: `${mod}+${shift}+8`,
        orderedList: `${mod}+${shift}+7`,
        alignLeft: `${mod}+${shift}+L`,
        alignCenter: `${mod}+${shift}+E`,
        alignRight: `${mod}+${shift}+R`,
        alignJustify: `${mod}+${shift}+J`,
        save: `${mod}+S`,
        undo: `${mod}+Z`,
        redo: isMacOS() ? `${mod}+${shift}+Z` : `${mod}+Y`,
      };

      return shortcuts[command] || '';
    }
  };
} 