const LT_ENDPOINT =
  (process.env.NEXT_PUBLIC_LT_URL || 'http://localhost:8010') + '/v2/check';

export interface LTMatch {
  message: string;
  offset: number;
  length: number;
  replacements: { value: string }[];
  rule: { id: string; description: string; category: { name: string } };
}

export async function checkWithLanguageTool(text: string, lang = 'en-US') {
  if (process.env.NEXT_PUBLIC_DISABLE_LT === 'true') {
    return [];        // skip checker entirely for CI / offline
  }

  console.log('📝 Sending request to LanguageTool:', {
    url: LT_ENDPOINT,
    text: text.substring(0, 50) + '...',
    lang
  });

  const formData = new URLSearchParams();
  formData.append('text', text);
  formData.append('language', lang);
  formData.append('disabledRules', 'WHITESPACE_RULE');  // Ignore HTML whitespace
  formData.append('enabledOnly', 'false');

  const res = await fetch(LT_ENDPOINT, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: formData.toString()
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`LT ${res.status}: ${res.statusText}\n${errorText}`);
  }

  const json: { matches: LTMatch[] } = await res.json();
  
  console.log('✅ LanguageTool response:', {
    matches: json.matches.length,
    suggestions: json.matches.map(m => ({
      text: m.message,
      replacement: m.replacements[0]?.value
    }))
  });

  return json.matches;
} 