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
          aria-label="Undo last action"
          role="button"
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
          aria-label="Redo last undone action"
          role="button"
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
          aria-label="Apply heading level 1 formatting"
          role="button"
        >
          H1
        </Toggle>

        <Toggle
          pressed={editor.isActive('heading', { level: 2 })}
          onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className="data-[state=on]:bg-indigo-400 data-[state=on]:text-white hover:bg-slate-200 text-slate-600 px-2 py-1 h-8"
          size="sm"
          title="Heading 2"
          aria-label="Apply heading level 2 formatting"
          role="button"
        >
          H2
        </Toggle>

        <Toggle
          pressed={editor.isActive('heading', { level: 3 })}
          onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className="data-[state=on]:bg-indigo-400 data-[state=on]:text-white hover:bg-slate-200 text-slate-600 px-2 py-1 h-8"
          size="sm"
          title="Heading 3"
          aria-label="Apply heading level 3 formatting"
          role="button"
        >
          H3
        </Toggle>

        <Toggle
          pressed={editor.isActive('paragraph')}
          onPressedChange={() => editor.chain().focus().setParagraph().run()}
          className="data-[state=on]:bg-indigo-400 data-[state=on]:text-white hover:bg-slate-200 text-slate-600 px-2 py-1 h-8"
          size="sm"
          title="Paragraph"
          aria-label="Apply paragraph formatting"
          role="button"
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
          aria-label="Toggle bold formatting"
          role="button"
        >
          <span className="font-bold">B</span>
        </Toggle>

        <Toggle
          pressed={editor.isActive('italic')}
          onPressedChange={() => editor.chain().focus().toggleItalic().run()}
          className="data-[state=on]:bg-indigo-400 data-[state=on]:text-white hover:bg-slate-200 text-slate-600 px-2 py-1 h-8"
          size="sm"
          title="Italic (Ctrl+I)"
          aria-label="Toggle italic formatting"
          role="button"
        >
          <span className="italic">I</span>
        </Toggle>

        <Toggle
          pressed={editor.isActive('underline')}
          onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
          className="data-[state=on]:bg-indigo-400 data-[state=on]:text-white hover:bg-slate-200 text-slate-600 px-2 py-1 h-8"
          size="sm"
          title="Underline (Ctrl+U)"
          aria-label="Toggle underline formatting"
          role="button"
        >
          <span className="underline">U</span>
        </Toggle>

        <Toggle
          pressed={editor.isActive('strike')}
          onPressedChange={() => editor.chain().focus().toggleStrike().run()}
          className="data-[state=on]:bg-indigo-400 data-[state=on]:text-white hover:bg-slate-200 text-slate-600 px-2 py-1 h-8"
          size="sm"
          title="Strikethrough"
          aria-label="Toggle strikethrough formatting"
          role="button"
        >
          <span className="line-through">S</span>
        </Toggle>

        <Toggle
          pressed={editor.isActive('highlight')}
          onPressedChange={() => editor.chain().focus().toggleHighlight().run()}
          className="data-[state=on]:bg-indigo-400 data-[state=on]:text-white hover:bg-slate-200 text-slate-600 px-2 py-1 h-8"
          size="sm"
          title="Highlight"
          aria-label="Toggle text highlighting"
          role="button"
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
          aria-label="Align text to the left"
          role="button"
        >
          ⬅
        </Toggle>

        <Toggle
          pressed={editor.isActive({ textAlign: 'center' })}
          onPressedChange={() => editor.chain().focus().setTextAlign('center').run()}
          className="data-[state=on]:bg-indigo-400 data-[state=on]:text-white hover:bg-slate-200 text-slate-600 px-2 py-1 h-8"
          size="sm"
          title="Align Center"
          aria-label="Center align text"
          role="button"
        >
          ↔
        </Toggle>

        <Toggle
          pressed={editor.isActive({ textAlign: 'right' })}
          onPressedChange={() => editor.chain().focus().setTextAlign('right').run()}
          className="data-[state=on]:bg-indigo-400 data-[state=on]:text-white hover:bg-slate-200 text-slate-600 px-2 py-1 h-8"
          size="sm"
          title="Align Right"
          aria-label="Align text to the right"
          role="button"
        >
          ➡
        </Toggle>

        <Toggle
          pressed={editor.isActive({ textAlign: 'justify' })}
          onPressedChange={() => editor.chain().focus().setTextAlign('justify').run()}
          className="data-[state=on]:bg-indigo-400 data-[state=on]:text-white hover:bg-slate-200 text-slate-600 px-2 py-1 h-8"
          size="sm"
          title="Justify"
          aria-label="Justify text alignment"
          role="button"
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
          aria-label="Create bullet point list"
          role="button"
        >
          •
        </Toggle>

        <Toggle
          pressed={editor.isActive('orderedList')}
          onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
          className="data-[state=on]:bg-indigo-400 data-[state=on]:text-white hover:bg-slate-200 text-slate-600 px-2 py-1 h-8"
          size="sm"
          title="Numbered List"
          aria-label="Create numbered list"
          role="button"
        >
          1.
        </Toggle>


      </div>
    </div>
  );
} 