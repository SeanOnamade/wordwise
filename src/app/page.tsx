'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { signOut, User } from 'firebase/auth';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user: User | null) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 w-full h-full">
        <div className="absolute top-20 left-20 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 bg-white/5 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2 group">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-blue-400 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <span className="text-2xl font-bold text-white">WordWise</span>
            </Link>
            <div className="flex items-center space-x-4">
              {!loading && (
                user ? (
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-gray-300 bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm">{user.email}</span>
                    <Button 
                      variant="outline"
                      onClick={handleSignOut}
                      className="text-sm bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm"
                    >
                      Sign Out
                    </Button>
                  </div>
                ) : (
                  <Button asChild variant="outline" className="text-sm bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm">
                    <Link href="/login">Sign In</Link>
                  </Button>
                )
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Hero Section */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-full border border-white/20 backdrop-blur-sm mb-8">
            <span className="text-sm text-purple-200 font-medium">🚀 AI-Powered Writing Assistant</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Write with 
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent"> Confidence</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-300 max-w-4xl mx-auto mb-12 leading-relaxed">
            Empowering <span className="text-purple-300 font-semibold">ESL students</span> and writers with intelligent, 
            educational feedback that helps you learn while you write. Get real-time suggestions powered by 
            <span className="text-blue-300 font-semibold"> OpenAI GPT-4o</span>.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <Button 
              asChild 
              size="lg"
              className="group bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-4 text-lg font-semibold rounded-xl shadow-2xl hover:shadow-purple-500/25 transition-all duration-300 hover:scale-105"
            >
              <Link href="/editor">
                <svg className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Start Writing Now
              </Link>
            </Button>
            
            <Button 
              asChild 
              variant="outline" 
              size="lg"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 px-8 py-4 text-lg rounded-xl backdrop-blur-sm transition-all duration-300 hover:scale-105"
            >
              <Link href="#features">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Learn More
              </Link>
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-20">
            <div className="text-center">
              <div className="text-3xl font-bold text-white mb-2">90%+</div>
              <div className="text-gray-400">Grammar Accuracy</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white mb-2">&lt;2s</div>
              <div className="text-gray-400">Response Time</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white mb-2">6</div>
              <div className="text-gray-400">Core Features</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white mb-2">WCAG 2.1</div>
              <div className="text-gray-400">AA Compliant</div>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div id="features" className="mb-20">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Powerful Features for 
              <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent"> Better Writing</span>
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Everything you need to improve your academic and professional writing, 
              designed specifically for ESL learners and accessibility.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* AI Smart Review - Featured */}
            <div className="lg:col-span-3 mb-8">
              <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 backdrop-blur-xl rounded-2xl p-8 border border-white/10 hover:border-white/20 transition-all duration-300 group">
                <div className="flex items-center mb-6">
                  <div className="p-4 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl mr-4 group-hover:scale-110 transition-transform duration-200">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-2">✨ AI Smart Review</h3>
                    <p className="text-purple-300 font-medium">Powered by OpenAI GPT-4o</p>
                  </div>
                </div>
                <p className="text-gray-300 text-lg mb-6">
                  Get advanced writing analysis with three core metrics: Clarity (0-100), Academic Tone (0-100), 
                  and Sentence Complexity (0-100). Identifies issues missed by traditional grammar checkers and 
                  provides up to 5 actionable suggestions for immediate improvement.
                </p>
                <div className="flex flex-wrap gap-3">
                  <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm border border-purple-500/30">Advanced AI Analysis</span>
                  <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm border border-blue-500/30">Educational Feedback</span>
                  <span className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-sm border border-green-500/30">Academic Writing Focus</span>
                </div>
              </div>
            </div>

            {/* Real-time Grammar */}
            <div className="group">
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all duration-300 hover:scale-105 h-full">
                <div className="p-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl w-fit mb-4 group-hover:scale-110 transition-transform duration-200">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Real-Time Grammar Check</h3>
                <p className="text-gray-300 mb-4">
                  Powered by LanguageTool with 90%+ accuracy. Get instant feedback with color-coded suggestions 
                  and educational explanations as you write.
                </p>
                <div className="text-sm text-green-300 font-medium">&lt; 2000ms response time</div>
              </div>
            </div>

            {/* Document Management */}
            <div className="group">
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all duration-300 hover:scale-105 h-full">
                <div className="p-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl w-fit mb-4 group-hover:scale-110 transition-transform duration-200">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Smart Document Export</h3>
                <p className="text-gray-300 mb-4">
                  Export to PDF and DOCX with formatting preservation. Copy clean HTML directly to 
                  Google Docs, Word, and Notion.
                </p>
                <div className="text-sm text-blue-300 font-medium">&lt; 5000ms export time</div>
              </div>
            </div>

            {/* Accessibility */}
            <div className="group">
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all duration-300 hover:scale-105 h-full">
                <div className="p-3 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl w-fit mb-4 group-hover:scale-110 transition-transform duration-200">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Fully Accessible</h3>
                <p className="text-gray-300 mb-4">
                  WCAG 2.1 AA compliant with full keyboard navigation, screen reader support, 
                  and 20+ keyboard shortcuts for power users.
                </p>
                <div className="text-sm text-orange-300 font-medium">Inclusive by design</div>
              </div>
            </div>

            {/* Learning & Personalization */}
            <div className="group">
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all duration-300 hover:scale-105 h-full">
                <div className="p-3 bg-gradient-to-r from-pink-500 to-rose-500 rounded-xl w-fit mb-4 group-hover:scale-110 transition-transform duration-200">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Personalized Learning</h3>
                <p className="text-gray-300 mb-4">
                  AI learns from your writing patterns and adapts suggestions. Track improvement 
                  over time with custom rule weighting for ESL-specific challenges.
                </p>
                <div className="text-sm text-pink-300 font-medium">Adaptive feedback</div>
              </div>
            </div>

            {/* Cross-Device Sync */}
            <div className="group">
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all duration-300 hover:scale-105 h-full">
                <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl w-fit mb-4 group-hover:scale-110 transition-transform duration-200">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Cross-Device Sync</h3>
                <p className="text-gray-300 mb-4">
                  Work seamlessly across desktop, tablet, and mobile. Auto-save with real-time 
                  synchronization and offline capability.
                </p>
                <div className="text-sm text-indigo-300 font-medium">Always in sync</div>
              </div>
            </div>
          </div>
        </div>

        {/* User Personas Section */}
        <div className="mb-20">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Built for 
              <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent"> Real Writers</span>
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              WordWise is designed for the diverse needs of modern writers, with a special focus on 
              ESL learners and accessibility.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Sarah - ESL Student */}
            <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 backdrop-blur-xl rounded-2xl p-8 border border-white/10">
              <div className="text-4xl mb-4">📚</div>
              <h3 className="text-2xl font-bold text-white mb-3">Sarah Chen</h3>
              <p className="text-purple-300 font-medium mb-4">ESL Graduate Student</p>
              <p className="text-gray-300 mb-6">
                PhD candidate who needs educational feedback on academic writing conventions 
                and grammar explanations to improve her research papers.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm">Academic Writing</span>
                <span className="px-3 py-1 bg-pink-500/20 text-pink-300 rounded-full text-sm">Learning Focus</span>
              </div>
            </div>

            {/* Ben - Project Manager */}
            <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 backdrop-blur-xl rounded-2xl p-8 border border-white/10">
              <div className="text-4xl mb-4">💼</div>
              <h3 className="text-2xl font-bold text-white mb-3">Ben Rodriguez</h3>
              <p className="text-blue-300 font-medium mb-4">Project Manager</p>
              <p className="text-gray-300 mb-6">
                Manages international teams and needs quick, professional corrections 
                for business communications and client proposals.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm">Business Writing</span>
                <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 rounded-full text-sm">Mobile Friendly</span>
              </div>
            </div>

            {/* Maya - Content Creator */}
            <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 backdrop-blur-xl rounded-2xl p-8 border border-white/10">
              <div className="text-4xl mb-4">✍️</div>
              <h3 className="text-2xl font-bold text-white mb-3">Maya Patel</h3>
              <p className="text-green-300 font-medium mb-4">Content Creator with Dyslexia</p>
              <p className="text-gray-300 mb-6">
                Creates educational content and needs accessible tools with visual highlighting 
                and keyboard navigation for assistive technology.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-sm">Accessibility</span>
                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-sm">Creative Writing</span>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-gradient-to-r from-purple-500/10 to-blue-500/10 backdrop-blur-xl rounded-3xl p-12 border border-white/10">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Transform Your Writing?
          </h2>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Join thousands of writers who are improving their skills with WordWise. 
            Start writing with confidence today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button 
              asChild 
              size="lg"
              className="group bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-10 py-4 text-xl font-semibold rounded-xl shadow-2xl hover:shadow-purple-500/25 transition-all duration-300 hover:scale-105"
            >
              <Link href="/editor">
                <svg className="w-6 h-6 mr-3 group-hover:rotate-12 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Start Writing for Free
              </Link>
            </Button>
          </div>
          <p className="text-sm text-gray-400 mt-4">
            No credit card required • Full feature access • WCAG 2.1 AA compliant
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 bg-white/5 backdrop-blur-xl border-t border-white/10 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <div className="w-6 h-6 bg-gradient-to-r from-purple-400 to-blue-400 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <span className="text-lg font-bold text-white">WordWise</span>
            </div>
            <div className="text-gray-400 text-sm">
              Built with ❤️ for writers worldwide • Powered by OpenAI GPT-4o & LanguageTool
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}