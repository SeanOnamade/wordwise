'use client';

import { Button } from '@/components/ui/button';
import { useEditorStore } from '@/store/editorStore';
import { Editor } from '@tiptap/react';

interface SmartReviewButtonProps {
  editor: Editor | null;
}

export default function SmartReviewButton({ editor }: SmartReviewButtonProps) {
  const { runSmartReview, smartReview, setSmartReviewError } = useEditorStore();

  const handleSmartReview = async () => {
    if (!editor) return;

    // Get the text content from the editor
    const content = editor.getText();
    
    if (!content.trim()) {
      setSmartReviewError('Please write some content first!');
      return;
    }

    try {
      console.log('🔄 Starting Smart Review...');
      await runSmartReview(content);
      console.log('✅ Smart Review completed');
    } catch (error) {
      console.error('❌ Smart Review failed:', error);
      setSmartReviewError(error instanceof Error ? error.message : 'Smart Review failed. Please try again.');
    }
  };

  return (
    <Button
      variant="default"
      size="sm"
      onClick={handleSmartReview}
      disabled={smartReview.loading || !editor}
      className="bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50 px-3 py-1 h-8 flex items-center gap-2 font-medium"
      title="Get AI-powered writing analysis with metrics and suggestions"
      aria-label="Run Smart Review to get AI analysis of your writing"
    >
      {smartReview.loading ? (
        <>
          <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
          Analyzing...
        </>
      ) : (
        <>
          <span className="text-sm">✨</span>
          Smart Review
        </>
      )}
    </Button>
  );
} 