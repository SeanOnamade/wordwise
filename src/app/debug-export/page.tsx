'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useState } from 'react';
import { handleDebugExport } from '@/lib/exportToPdf';

export default function DebugExport() {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const editor = useEditor({
    extensions: [StarterKit],
    content: `
      <h1>WordWise Export Test</h1>
      <p>This is a test document to verify PDF export formatting.</p>
      <h2>Formatting Tests</h2>
      <p>Here are some <strong>bold</strong>, <em>italic</em>, and <u>underlined</u> text examples.</p>
      <h3>Lists</h3>
      <ul>
        <li>Bullet point 1</li>
        <li>Bullet point 2</li>
      </ul>
      <ol>
        <li>Numbered item 1</li>
        <li>Numbered item 2</li>
      </ol>
      <h3>Alignment</h3>
      <p style="text-align: center">This text is centered</p>
      <p style="text-align: right">This text is right-aligned</p>
      <p style="text-align: justify">This text is justified and should wrap to demonstrate proper text alignment in the exported PDF document.</p>
      <h3>Grammar Check Test</h3>
      <p>Here is a <mark data-suggestion-id="test" class="lt-error">mispeled</mark> word that should not show highlighting in the PDF.</p>
    `,
  });

  const handleExport = async () => {
    if (!editor) return;

    try {
      setError(null);
      const html = editor.getHTML();
      const { pdf, sizeInKb } = await handleDebugExport(html);
      
      // Create blob URL for preview
      const blob = new Blob([pdf], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export PDF');
    }
  };

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  if (!editor) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">PDF Export Debug</h1>
      
      <div className="mb-4 p-4 border rounded">
        <EditorContent editor={editor} />
      </div>

      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Export to PDF
        </button>
        
        {error && (
          <p className="text-red-500">{error}</p>
        )}
      </div>

      {pdfUrl && (
        <div className="border rounded p-4">
          <h2 className="text-lg font-semibold mb-2">Preview</h2>
          <iframe
            src={pdfUrl}
            className="w-full h-[800px] border"
            title="PDF Preview"
          />
        </div>
      )}
    </div>
  );
} 