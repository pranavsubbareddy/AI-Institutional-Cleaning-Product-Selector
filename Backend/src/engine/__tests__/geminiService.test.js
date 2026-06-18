const {
  generateRecommendations,
  getGroqKeyCandidates,
  extractJSON,
} = require('../geminiService');

// ---------------------------------------------------------------------------
// Helper: create base institution params
// ---------------------------------------------------------------------------
function makeParams(overrides = {}) {
  return {
    institution_type: 'hospital',
    area_size: 5000,
    surface_types: ['hard_floor', 'tile'],
    hygiene_standard: 'standard',
    budget: 'medium',
    metadata: null,
    ...overrides,
  };
}

function clearAIKeys() {
  Object.keys(process.env)
    .filter(name => /^(?:OPENAI|GEMINI|GOOGLE(?:_AI)?|GROQ)(?:_(?:API_)?KEYS?|_(?:API_)?KEY_\d+)$/i.test(name)
      || /^GROQ_(?:API_)?KEY_\d+$/i.test(name))
    .forEach(name => {
      delete process.env[name];
    });
}

// ---------------------------------------------------------------------------
// 1. getGroqKeyCandidates TESTS
// ---------------------------------------------------------------------------
describe('getGroqKeyCandidates', () => {
  const OLD_ENV = process.env;

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test('collects comma-separated and numbered Groq keys', () => {
    clearAIKeys();
    process.env.GROQ_API_KEYS = 'gsk_key-a, gsk_key-b';
    process.env.GROQ_API_KEY_2 = 'gsk_key-d';
    process.env.GROQ_API_KEY_1 = 'gsk_key-c';

    expect(getGroqKeyCandidates()).toEqual([
      'gsk_key-a',
      'gsk_key-b',
      'gsk_key-c',
      'gsk_key-d',
    ]);
  });

  test('collects Groq keys from single GROQ_API_KEY env var', () => {
    clearAIKeys();
    process.env.GROQ_API_KEY = 'gsk_single-key';

    expect(getGroqKeyCandidates()).toEqual(['gsk_single-key']);
  });

  test('ignores non-gsk_ prefixed keys', () => {
    clearAIKeys();
    process.env.GROQ_API_KEY = 'not-a-groq-key';

    expect(getGroqKeyCandidates()).toEqual([]);
  });

  test('deduplicates keys across env vars', () => {
    clearAIKeys();
    process.env.GROQ_API_KEY = 'gsk_dup-key';
    process.env.GROQ_API_KEYS = 'gsk_dup-key, gsk_other-key';

    expect(getGroqKeyCandidates()).toEqual(['gsk_dup-key', 'gsk_other-key']);
  });

  test('returns empty array when no Groq keys are set', () => {
    clearAIKeys();
    expect(getGroqKeyCandidates()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2. generateRecommendations — returns null when no API key
// ---------------------------------------------------------------------------
describe('generateRecommendations — null return when API key missing', () => {
  const OLD_ENV = process.env;

  beforeAll(() => {
    clearAIKeys();
    jest.resetModules();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test('returns null when no API key is set', async () => {
    clearAIKeys();
    const result = await generateRecommendations(makeParams());
    expect(result).toBeNull();
  });

  test('returns null when API key format is invalid', async () => {
    clearAIKeys();
    process.env.GROQ_API_KEY = 'invalid-key-format';
    jest.resetModules();
    const mod = require('../geminiService');
    const result = await mod.generateRecommendations(makeParams());
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. extractJSON TESTS
// ---------------------------------------------------------------------------
describe('extractJSON', () => {
  // ── Falsy / empty inputs ──────────────────────────────────────────────
  test('returns null for undefined', () => {
    expect(extractJSON(undefined)).toBeNull();
  });

  test('returns null for null', () => {
    expect(extractJSON(null)).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(extractJSON('')).toBeNull();
  });

  test('returns null for whitespace-only string', () => {
    expect(extractJSON('   \n\t  ')).toBeNull();
  });

  // ── Clean valid JSON ──────────────────────────────────────────────────
  test('parses clean JSON object', () => {
    const input = JSON.stringify({ a: 1, b: 'hello' });
    const result = extractJSON(input);
    expect(result).toEqual({ a: 1, b: 'hello' });
  });

  test('parses clean JSON with nested objects', () => {
    const input = JSON.stringify({
      recommendations: [{ id: 'a', name: 'Test' }],
      summary: { cost: 100 },
    });
    const result = extractJSON(input);
    expect(result.recommendations.length).toBe(1);
    expect(result.recommendations[0].id).toBe('a');
    expect(result.summary.cost).toBe(100);
  });

  test('parses clean JSON with arrays', () => {
    const result = extractJSON('[1, 2, 3]');
    expect(result).toEqual([1, 2, 3]);
  });

  test('parses JSON with leading/trailing whitespace', () => {
    const result = extractJSON('  { "key": "value" }  \n');
    expect(result).toEqual({ key: 'value' });
  });

  // ── Markdown fences ───────────────────────────────────────────────────
  test('removes ```json code fences', () => {
    const input = '```json\n{"key": "value"}\n```';
    expect(extractJSON(input)).toEqual({ key: 'value' });
  });

  test('removes ```javascript code fences', () => {
    const input = '```javascript\n{"key": "value"}\n```';
    expect(extractJSON(input)).toEqual({ key: 'value' });
  });

  test('removes ```js code fences', () => {
    const input = '```js\n{"key": "value"}\n```';
    expect(extractJSON(input)).toEqual({ key: 'value' });
  });

  test('removes plain ``` (no language) fences', () => {
    const input = '```\n{"key": "value"}\n```';
    expect(extractJSON(input)).toEqual({ key: 'value' });
  });

  test('removes fences with no trailing backticks', () => {
    const input = '```json\n{"key": "value"}\n';
    expect(extractJSON(input)).toEqual({ key: 'value' });
  });

  test('handles fences with leading text before', () => {
    const input = 'Here is the result:\n```json\n{"key": "value"}\n```';
    expect(extractJSON(input)).toEqual({ key: 'value' });
  });

  // ── BOM character ─────────────────────────────────────────────────────
  test('removes BOM character (\\uFEFF) prefix', () => {
    const input = '\uFEFF{"key": "value"}';
    expect(extractJSON(input)).toEqual({ key: 'value' });
  });

  test('removes BOM character with fences', () => {
    const input = '\uFEFF```json\n{"key": "value"}\n```';
    expect(extractJSON(input)).toEqual({ key: 'value' });
  });

  // ── Leading / trailing text ───────────────────────────────────────────
  test('strips text before first "{"', () => {
    const result = extractJSON('Explanation text before the JSON: { "key": "value" }');
    expect(result).toEqual({ key: 'value' });
  });

  test('strips text after last "}"', () => {
    const result = extractJSON('{ "key": "value" } and some trailing explanation');
    expect(result).toEqual({ key: 'value' });
  });

  test('strips both leading and trailing text', () => {
    const result = extractJSON('Leading text { "key": "value" } trailing text');
    expect(result).toEqual({ key: 'value' });
  });

  // ── Unescaped newlines / special chars (second parse attempt) ─────────
  test('handles unescaped newlines within string values', () => {
    const input = '{"text": "line1\nline2\nline3"}';
    const result = extractJSON(input);
    // \n in JSON string values is the newline escape, so JSON.parse returns actual newlines
    expect(result).toEqual({ text: 'line1\nline2\nline3' });
  });

  test('handles unescaped tabs within string values', () => {
    const input = '{"text": "col1\tcol2\tcol3"}';
    const result = extractJSON(input);
    // \t in JSON string values is the tab escape, so JSON.parse returns actual tabs
    expect(result).toEqual({ text: 'col1\tcol2\tcol3' });
  });

  test('handles unescaped carriage returns within string values', () => {
    const input = '{"text": "line1\r\nline2"}';
    const result = extractJSON(input);
    // \r\n in JSON string values are the CR+LF escapes, so JSON.parse returns actual CR+LF
    expect(result).toEqual({ text: 'line1\r\nline2' });
  });

  // ── Invalid input ─────────────────────────────────────────────────────
  test('returns null for completely invalid text', () => {
    expect(extractJSON('This is not JSON at all')).toBeNull();
  });

  test('returns null for random text with braces but not JSON', () => {
    expect(extractJSON('just { some random braces } here')).toBeNull();
  });

  test('returns null for malformed JSON with unmatched braces', () => {
    expect(extractJSON('{ "key": "value" ')).toBeNull();
  });

  test('returns null for truncated JSON', () => {
    expect(extractJSON('{ "key": "val')).toBeNull();
  });

  // ── Combined edge cases ───────────────────────────────────────────────
  test('handles BOM + fences + leading text + trailing text combined', () => {
    const bom = String.fromCharCode(0xFEFF);
    const input = `${bom}Here is the answer:\n\`\`\`json\n{ "recommendations": [], "summary": { "grossAggregatedCost": 0, "financialStatusAlert": null } }\n\`\`\`\nHope this helps!`;
    const result = extractJSON(input);
    expect(result).toEqual({
      recommendations: [],
      summary: { grossAggregatedCost: 0, financialStatusAlert: null },
    });
  });

  test('handles fences + leading text + unescaped newlines combined', () => {
    const input = 'Response: ```\n{"message": "Hello\nWorld"}\n``` End.';
    const result = extractJSON(input);
    expect(result).toEqual({ message: 'Hello\nWorld' });
  });

  test('handles real-world Gemini-like response', () => {
    const input = [
      'Here is the analysis for your facility:',
      '',
      '```json',
      '{',
      '  "recommendations": [',
      '    {',
      '      "productId": "prod-gpc-001",',
      '      "sku": "GPC-5L-001",',
      '      "name": "Multi-Purpose Cleaner",',
      '      "recommended_dilution": "1:40 (40ml per litre)",',
      '      "estimated_monthly_qty_units": 25,',
      '      "calculated_cost": 4500,',
      '      "usage_guidance": "Dilute 40ml per litre",',
      '      "safety_notes": "Wear gloves"',
      '    }',
      '  ],',
      '  "summary": {',
      '    "grossAggregatedCost": 4500,',
      '    "financialStatusAlert": null',
      '  }',
      '}',
      '```',
      '',
      'Please let me know if you need any clarification.',
    ].join('\n');

    const result = extractJSON(input);
    expect(result).toBeDefined();
    expect(result.recommendations.length).toBe(1);
    expect(result.recommendations[0].productId).toBe('prod-gpc-001');
    expect(result.summary.grossAggregatedCost).toBe(4500);
    expect(result.summary.financialStatusAlert).toBeNull();
  });

  // ── Empty / minimal JSON structures ───────────────────────────────────
  test('parses empty object', () => {
    expect(extractJSON('{}')).toEqual({});
  });

  test('parses empty array', () => {
    expect(extractJSON('[]')).toEqual([]);
  });

  test('parses JSON with a null value', () => {
    expect(extractJSON('null')).toBeNull();
  });

  test('parses JSON with numeric value', () => {
    expect(extractJSON('42')).toBe(42);
  });

  test('parses JSON with boolean value', () => {
    expect(extractJSON('true')).toBe(true);
  });

  // ── Double-parse resilience ───────────────────────────────────────────
  test('does not crash on oddly formatted text that has braces', () => {
    const result = extractJSON('Some text with { but no closing brace in the right place');
    expect(result).toBeNull();
  });

  test('does not crash on text with only opening brace', () => {
    const result = extractJSON('{');
    expect(result).toBeNull();
  });

  test('does not crash on text with only closing brace', () => {
    const result = extractJSON('}');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. EDGE CASE TESTS — generateRecommendations returns null when no API key
// ---------------------------------------------------------------------------
describe('Edge cases — no API key', () => {
  const OLD_ENV = process.env;

  beforeAll(() => {
    clearAIKeys();
    jest.resetModules();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test('returns null when no API key', async () => {
    clearAIKeys();
    const result = await generateRecommendations(makeParams());
    expect(result).toBeNull();
  });

  test('returns null when API key format is invalid', async () => {
    clearAIKeys();
    process.env.GROQ_API_KEY = 'bad-key';
    jest.resetModules();
    const mod = require('../geminiService');
    const result = await mod.generateRecommendations(makeParams());
    expect(result).toBeNull();
  });
});
