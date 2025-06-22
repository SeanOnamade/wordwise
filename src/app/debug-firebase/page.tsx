'use client';

import React from 'react';

export default function FirebaseDebugPage() {
  const env = (key: string): string => (process.env[key] ?? '').trim();

  const firebaseConfig = {
    apiKey: env('NEXT_PUBLIC_FIREBASE_API_KEY'),
    authDomain: env('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'),
    projectId: env('NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
    storageBucket: env('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: env('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
    appId: env('NEXT_PUBLIC_FIREBASE_APP_ID'),
  };

  const requiredFields = ['apiKey', 'authDomain', 'projectId', 'appId'];
  const missingFields = requiredFields.filter(field => !firebaseConfig[field as keyof typeof firebaseConfig]);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Firebase Configuration Debug</h1>
        
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Environment Variables Status</h2>
          <div className="space-y-2">
            {requiredFields.map(field => {
              const envKey = `NEXT_PUBLIC_FIREBASE_${field.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
              const value = firebaseConfig[field as keyof typeof firebaseConfig];
              const hasValue = !!value;
              
              return (
                <div key={field} className={`p-3 rounded ${hasValue ? 'bg-green-100' : 'bg-red-100'}`}>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{envKey}</span>
                    <span className={`px-2 py-1 rounded text-sm ${hasValue ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                      {hasValue ? '✅ Set' : '❌ Missing'}
                    </span>
                  </div>
                  {hasValue && (
                    <div className="text-sm text-gray-600 mt-1">
                      Length: {value?.length || 0} characters
                      {field === 'projectId' && <span className="ml-2">Value: {value}</span>}
                      {field === 'authDomain' && <span className="ml-2">Value: {value}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {missingFields.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-red-800 mb-2">Missing Configuration</h3>
            <p className="text-red-700 mb-4">
              The following environment variables are missing or empty:
            </p>
            <ul className="list-disc list-inside text-red-700 space-y-1">
              {missingFields.map(field => (
                <li key={field}>
                  <code className="bg-red-100 px-2 py-1 rounded">
                    NEXT_PUBLIC_FIREBASE_{field.replace(/([A-Z])/g, '_$1').toUpperCase()}
                  </code>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">How to Fix</h3>
          <ol className="list-decimal list-inside text-blue-700 space-y-2">
            <li>Create a <code className="bg-blue-100 px-2 py-1 rounded">.env.local</code> file in your project root</li>
            <li>Add your Firebase configuration from the Firebase Console:</li>
            <pre className="bg-blue-100 p-3 rounded mt-2 text-sm overflow-x-auto">
{`NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id`}
            </pre>
            <li>Restart your development server</li>
            <li>Refresh this page to verify the configuration</li>
          </ol>
        </div>

        <div className="mt-6 text-center">
          <a 
            href="/editor" 
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ← Back to Editor
          </a>
        </div>
      </div>
    </div>
  );
} 