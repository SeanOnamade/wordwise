import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

describe('Suggestion accuracy suite', () => {
  const text = fs.readFileSync(
    path.join(__dirname, 'sampleText.txt'),
    'utf8'
  );

  it('returns at least 15 suggestions covering all rule types', async () => {
    const res = await fetch('http://localhost:3000/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docId: 'test', text }),
    });
    expect(res.status).toBe(200);
    const { suggestions } = await res.json();
    expect(suggestions.length).toBeGreaterThanOrEqual(15);

    const types = suggestions.map((s: any) => s.type);
    const mustHave = [
      'duplicate',     // the the
      'article',       // an/a misuse
      'sv_agreement',  // present -> presents
      'verb_tense',    // addresses
      'preposition',   // debate about
      'run_on',        // however comma splice
      'comma_splice',  // same
      'tone',          // gonna
      'uncountable',   // informations
      'word_order',    // data were shows
      'spelling',      // misspelld
      'passive',       // was being observed
      'pronoun',       // they affects
      'oxford_comma',  // solar and hydro
      'capitalization' // sentence start lowercase
    ];

    mustHave.forEach(rule =>
      expect(types).toContain(rule)
    );
  }, 15000);
}); 