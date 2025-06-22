export interface SmartReviewMetric {
  score: number;
  comment: string;
}

export interface SmartReviewIssue {
  excerpt: string;
  explanation: string;
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