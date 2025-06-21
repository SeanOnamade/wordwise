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
    <div className="bg-slate-100 shadow-[0_0_0_1px_#1d2a47] rounded-t-lg overflow-x-auto">
      <div className="flex items-center gap-0.5 p-2 min-w-max">
        {/* Undo/Redo */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="text-slate-600 hover:text-slate-900 hover:bg-slate-200 disabled:opacity-50 px-2 py-1 h-8"
          title="Undo (Ctrl+Z)"
        >
          ↶
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="text-slate-600 hover:text-slate-900 hover:bg-slate-200 disabled:opacity-50 px-2 py-1 h-8"
          title="Redo (Ctrl+Y)"
        >
          ↷
        </Button>

        {/* Separator */}
        <div className="w-px h-6 bg-slate-300 mx-1"></div>

        {/* Headings and Paragraph */}
        <Toggle
          pressed={editor.isActive('heading', { level: 1 })}
          onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className="data-[state=on]:bg-indigo-400 data-[state=on]:text-white hover:bg-slate-200 text-slate-600 px-2 py-1 h-8"
          size="sm"
          title="Heading 1"
        >
          H1
        </Toggle>

        <Toggle
          pressed={editor.isActive('heading', { level: 2 })}
          onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className="data-[state=on]:bg-indigo-400 data-[state=on]:text-white hover:bg-slate-200 text-slate-600 px-2 py-1 h-8"
          size="sm"
          title="Heading 2"
        >
          H2
        </Toggle>

        <Toggle
          pressed={editor.isActive('heading', { level: 3 })}
          onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className="data-[state=on]:bg-indigo-400 data-[state=on]:text-white hover:bg-slate-200 text-slate-600 px-2 py-1 h-8"
          size="sm"
          title="Heading 3"
        >
          H3
        </Toggle>

        <Toggle
          pressed={editor.isActive('paragraph')}
          onPressedChange={() => editor.chain().focus().setParagraph().run()}
          className="data-[state=on]:bg-indigo-400 data-[state=on]:text-white hover:bg-slate-200 text-slate-600 px-2 py-1 h-8"
          size="sm"
          title="Paragraph"
        >
          P
        </Toggle>

        {/* Separator */}
        <div className="w-px h-6 bg-slate-300 mx-1"></div>

        {/* Text Formatting */}
        <Toggle
          pressed={editor.isActive('bold')}
          onPressedChange={() => editor.chain().focus().toggleBold().run()}
          className="data-[state=on]:bg-indigo-400 data-[state=on]:text-white hover:bg-slate-200 text-slate-600 px-2 py-1 h-8"
          size="sm"
          title="Bold (Ctrl+B)"
        >
          <span className="font-bold">B</span>
        </Toggle>

        <Toggle
          pressed={editor.isActive('italic')}
          onPressedChange={() => editor.chain().focus().toggleItalic().run()}
          className="data-[state=on]:bg-indigo-400 data-[state=on]:text-white hover:bg-slate-200 text-slate-600 px-2 py-1 h-8"
          size="sm"
          title="Italic (Ctrl+I)"
        >
          <span className="italic">I</span>
        </Toggle>

        <Toggle
          pressed={editor.isActive('underline')}
          onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
          className="data-[state=on]:bg-indigo-400 data-[state=on]:text-white hover:bg-slate-200 text-slate-600 px-2 py-1 h-8"
          size="sm"
          title="Underline (Ctrl+U)"
        >
          <span className="underline">U</span>
        </Toggle>

        <Toggle
          pressed={editor.isActive('strike')}
          onPressedChange={() => editor.chain().focus().toggleStrike().run()}
          className="data-[state=on]:bg-indigo-400 data-[state=on]:text-white hover:bg-slate-200 text-slate-600 px-2 py-1 h-8"
          size="sm"
          title="Strikethrough"
        >
          <span className="line-through">S</span>
        </Toggle>

        <Toggle
          pressed={editor.isActive('highlight')}
          onPressedChange={() => editor.chain().focus().toggleHighlight().run()}
          className="data-[state=on]:bg-indigo-400 data-[state=on]:text-white hover:bg-slate-200 text-slate-600 px-2 py-1 h-8"
          size="sm"
          title="Highlight"
        >
          <span className="bg-yellow-200 px-1 rounded text-xs">H</span>
        </Toggle>

        {/* Separator */}
        <div className="w-px h-6 bg-slate-300 mx-1"></div>

        {/* Text Alignment */}
        <Toggle
          pressed={editor.isActive({ textAlign: 'left' })}
          onPressedChange={() => editor.chain().focus().setTextAlign('left').run()}
          className="data-[state=on]:bg-indigo-400 data-[state=on]:text-white hover:bg-slate-200 text-slate-600 px-2 py-1 h-8"
          size="sm"
          title="Align Left"
        >
          ⬅
        </Toggle>

        <Toggle
          pressed={editor.isActive({ textAlign: 'center' })}
          onPressedChange={() => editor.chain().focus().setTextAlign('center').run()}
          className="data-[state=on]:bg-indigo-400 data-[state=on]:text-white hover:bg-slate-200 text-slate-600 px-2 py-1 h-8"
          size="sm"
          title="Align Center"
        >
          ↔
        </Toggle>

        <Toggle
          pressed={editor.isActive({ textAlign: 'right' })}
          onPressedChange={() => editor.chain().focus().setTextAlign('right').run()}
          className="data-[state=on]:bg-indigo-400 data-[state=on]:text-white hover:bg-slate-200 text-slate-600 px-2 py-1 h-8"
          size="sm"
          title="Align Right"
        >
          ➡
        </Toggle>

        <Toggle
          pressed={editor.isActive({ textAlign: 'justify' })}
          onPressedChange={() => editor.chain().focus().setTextAlign('justify').run()}
          className="data-[state=on]:bg-indigo-400 data-[state=on]:text-white hover:bg-slate-200 text-slate-600 px-2 py-1 h-8"
          size="sm"
          title="Justify"
        >
          ≡
        </Toggle>

        {/* Separator */}
        <div className="w-px h-6 bg-slate-300 mx-1"></div>

        {/* Lists */}
        <Toggle
          pressed={editor.isActive('bulletList')}
          onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
          className="data-[state=on]:bg-indigo-400 data-[state=on]:text-white hover:bg-slate-200 text-slate-600 px-2 py-1 h-8"
          size="sm"
          title="Bullet List"
        >
          •
        </Toggle>

        <Toggle
          pressed={editor.isActive('orderedList')}
          onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
          className="data-[state=on]:bg-indigo-400 data-[state=on]:text-white hover:bg-slate-200 text-slate-600 px-2 py-1 h-8"
          size="sm"
          title="Numbered List"
        >
          1.
        </Toggle>
      </div>
    </div>
  );
} 