'use client';

import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { Editor } from '@tiptap/react';

interface ToolbarProps {
  editor: Editor | null;
}

export default function Toolbar({ editor }: ToolbarProps) {
  if (!editor) {
    return null;
  }

  return (
    <div className="bg-slate-100 shadow-[0_0_0_1px_#1d2a47] rounded-t-lg">
      <div className="flex items-center space-x-1 p-3">
        {/* Undo/Redo */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="text-slate-600 hover:text-slate-900 hover:bg-slate-200 disabled:opacity-50"
          title="Undo (Ctrl+Z)"
        >
          ↶
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="text-slate-600 hover:text-slate-900 hover:bg-slate-200 disabled:opacity-50"
          title="Redo (Ctrl+Y)"
        >
          ↷
        </Button>

        {/* Separator */}
        <div className="w-px h-6 bg-slate-300 mx-2"></div>

        {/* Text Formatting */}
        <Toggle
          pressed={editor.isActive('bold')}
          onPressedChange={() => editor.chain().focus().toggleBold().run()}
          className="data-[state=on]:bg-indigo-400 data-[state=on]:text-white hover:bg-slate-200 text-slate-600"
          size="sm"
          title="Bold (Ctrl+B)"
        >
          <span className="font-bold">B</span>
        </Toggle>

        <Toggle
          pressed={editor.isActive('italic')}
          onPressedChange={() => editor.chain().focus().toggleItalic().run()}
          className="data-[state=on]:bg-indigo-400 data-[state=on]:text-white hover:bg-slate-200 text-slate-600"
          size="sm"
          title="Italic (Ctrl+I)"
        >
          <span className="italic">I</span>
        </Toggle>

        {/* Separator */}
        <div className="w-px h-6 bg-slate-300 mx-2"></div>

        {/* Headings */}
        <Toggle
          pressed={editor.isActive('heading', { level: 1 })}
          onPressedChange={() => editor.commands.toggleHeading({ level: 1 })}
          className="data-[state=on]:bg-indigo-400 data-[state=on]:text-white hover:bg-slate-200 text-slate-600"
          size="sm"
          title="Heading 1"
        >
          H1
        </Toggle>

        <Toggle
          pressed={editor.isActive('heading', { level: 2 })}
          onPressedChange={() => editor.commands.toggleHeading({ level: 2 })}
          className="data-[state=on]:bg-indigo-400 data-[state=on]:text-white hover:bg-slate-200 text-slate-600"
          size="sm"
          title="Heading 2"
        >
          H2
        </Toggle>

        {/* Separator */}
        <div className="w-px h-6 bg-slate-300 mx-2"></div>

        {/* Lists */}
        <Toggle
          pressed={editor.isActive('bulletList')}
          onPressedChange={() => editor.commands.toggleBulletList()}
          className="data-[state=on]:bg-indigo-400 data-[state=on]:text-white hover:bg-slate-200 text-slate-600"
          size="sm"
          title="Bullet List"
        >
          •
        </Toggle>

        <Toggle
          pressed={editor.isActive('orderedList')}
          onPressedChange={() => editor.commands.toggleOrderedList()}
          className="data-[state=on]:bg-indigo-400 data-[state=on]:text-white hover:bg-slate-200 text-slate-600"
          size="sm"
          title="Numbered List"
        >
          1.
        </Toggle>
      </div>
    </div>
  );
} 