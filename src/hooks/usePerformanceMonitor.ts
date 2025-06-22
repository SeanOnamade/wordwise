'use client';

import { useCallback } from 'react';

interface PerformanceMetrics {
  format: string;
  duration: number;
  fileSize: number;
  success: boolean;
  error?: string;
}

interface ExportMetrics extends PerformanceMetrics {
  format: 'pdf' | 'docx' | 'txt';
}

export function usePerformanceMonitor() {
  const trackExport = useCallback((metrics: ExportMetrics) => {
    // Log to console for development
    console.log('📊 Export Performance:', {
      format: metrics.format.toUpperCase(),
      duration: `${metrics.duration}ms`,
      fileSize: `${Math.round(metrics.fileSize / 1024)}KB`,
      success: metrics.success,
      ...(metrics.error && { error: metrics.error })
    });

    // Send to analytics service if available
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'document_export', {
        event_category: 'export',
        event_label: metrics.format,
        value: metrics.duration,
        custom_parameter_file_size: metrics.fileSize,
        custom_parameter_success: metrics.success
      });
    }

    // Send to Sentry for error tracking
    if (metrics.error && typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(new Error(`Export failed: ${metrics.error}`), {
        tags: {
          format: metrics.format,
          component: 'export'
        },
        extra: {
          duration: metrics.duration,
          fileSize: metrics.fileSize
        }
      });
    }
  }, []);

  const trackGrammarCheck = useCallback((metrics: {
    duration: number;
    suggestionsCount: number;
    success: boolean;
    error?: string;
  }) => {
    console.log('📊 Grammar Check Performance:', {
      duration: `${metrics.duration}ms`,
      suggestions: metrics.suggestionsCount,
      success: metrics.success,
      ...(metrics.error && { error: metrics.error })
    });

    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'grammar_check', {
        event_category: 'grammar',
        value: metrics.duration,
        custom_parameter_suggestions: metrics.suggestionsCount,
        custom_parameter_success: metrics.success
      });
    }
  }, []);

  const trackSave = useCallback((metrics: {
    duration: number;
    fileSize: number;
    success: boolean;
    error?: string;
  }) => {
    console.log('📊 Save Performance:', {
      duration: `${metrics.duration}ms`,
      fileSize: `${Math.round(metrics.fileSize / 1024)}KB`,
      success: metrics.success,
      ...(metrics.error && { error: metrics.error })
    });

    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'document_save', {
        event_category: 'save',
        value: metrics.duration,
        custom_parameter_file_size: metrics.fileSize,
        custom_parameter_success: metrics.success
      });
    }
  }, []);

  return {
    trackExport,
    trackGrammarCheck,
    trackSave
  };
} 