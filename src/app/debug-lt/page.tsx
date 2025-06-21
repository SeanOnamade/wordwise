'use client';

import { useEffect } from 'react';

export default function DebugLT() {
  useEffect(() => {
    fetch('/api/lt-self-test')
      .then(r => r.json())
      .then(res => {
        console.log('LT-self-test', res);
      });
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">LanguageTool Debug</h1>
      <p className="text-gray-600">Check the console for test results.</p>
    </div>
  );
} 