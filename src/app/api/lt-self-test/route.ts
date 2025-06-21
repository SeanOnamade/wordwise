import { NextResponse } from 'next/server';
import { checkWithLanguageTool } from '@/lib/languageTool';

export async function GET() {
  const testText = "I definately recieve teh wrong adress.";
  
  try {
    console.log('🔧 Environment check:', {
      LT_URL: process.env.NEXT_PUBLIC_LT_URL,
      ENV: process.env.NEXT_PUBLIC_ENV,
      DISABLE_LT: process.env.NEXT_PUBLIC_DISABLE_LT
    });
    
    console.log('🔍 Testing LanguageTool connection...');
    const matches = await checkWithLanguageTool(testText);
    console.log('✅ LanguageTool test successful:', {
      text: testText,
      matches: matches.length,
      suggestions: matches.map(m => m.replacements[0]?.value)
    });
    
    return NextResponse.json({
      success: true,
      matches,
      config: {
        LT_URL: process.env.NEXT_PUBLIC_LT_URL,
        ENV: process.env.NEXT_PUBLIC_ENV
      }
    });
  } catch (error) {
    console.error('❌ LanguageTool test failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Test failed',
        config: {
          LT_URL: process.env.NEXT_PUBLIC_LT_URL,
          ENV: process.env.NEXT_PUBLIC_ENV
        }
      },
      { status: 500 }
    );
  }
} 