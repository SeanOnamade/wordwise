export interface SmartReviewMetric {
  score: number;
  explanation: string;
}

export interface SmartReviewIssue {
  id: string;
  excerpt: string;
  explanation: string;
  suggestions: string[];
  range?: {
    from: number;
    to: number;
  };
  status: 'new' | 'applied' | 'dismissed';
}

export interface SmartReview {
  issues: SmartReviewIssue[];
  metrics: {
    clarity: SmartReviewMetric;
    academic_tone: SmartReviewMetric;
    sentence_complexity: SmartReviewMetric;
  };
  suggestions: string[];
}

export interface SmartReviewState {
  data: SmartReview | null;
  isOpen: boolean;
  loading: boolean;
  error?: string;
} 