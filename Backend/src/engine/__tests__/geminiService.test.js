const {
  generateRecommendations,
  getAIClient,
  getOpenAIKeyCandidates,
  getGeminiKeyCandidates,
  extractJSON,
} = require('../geminiService');

// Mock OpenAI to avoid needing fetch in jsdom test environment
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  }));
});

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: jest.fn(),
    },
  })),
}));

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
    .filter(name => /^(?:OPENAI|GEMINI|GOOGLE(?:_AI)?)_(?:API_)?KEYS?(_\d+)?$/i.test(name))
    .forEach(name => {
      delete process.env[name];
    });
}

// ---------------------------------------------------------------------------
// 1. getAIClient TESTS (isolated to avoid singleton issues)
// ---------------------------------------------------------------------------
describe('getAIClient', () => {
  const OLD_ENV = process.env;

  afterAll(() => {
    process.env = OLD_ENV;
  });

  function getIsolatedAIClient() {
    let result;
    jest.isolateModules(() => {
      const mod = require('../geminiService');
      result = mod.getAIClient();
    });
    return result;
  }

  test('returns null when no API key is set', () => {
    clearAIKeys();
    expect(getIsolatedAIClient()).toBeNull();
  });

  test('returns null when API key is placeholder value', () => {
    clearAIKeys();
    process.env.OPENAI_API_KEY = 'invalid-key-format';
    expect(getIsolatedAIClient()).toBeNull();
  });

  test('reads OPENAI_API_KEY env var', () => {
    clearAIKeys();
    process.env.OPENAI_API_KEY = 'sk-proj-test-key-123';
    const client = getIsolatedAIClient();
    expect(client).not.toBeNull();
  });

  test('reads OPENAI_KEY as fallback', () => {
    clearAIKeys();
    process.env.OPENAI_KEY = 'sk-proj-fallback-key-456';
    expect(getIsolatedAIClient()).not.toBeNull();
  });

  test('prefers OPENAI_API_KEY over OPENAI_KEY', () => {
    clearAIKeys();
    process.env.OPENAI_API_KEY = 'sk-proj-primary-key';
    process.env.OPENAI_KEY = 'sk-proj-fallback-key';
    expect(getIsolatedAIClient()).not.toBeNull();
  });
});

describe('getOpenAIKeyCandidates', () => {
  const OLD_ENV = process.env;

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test('collects comma-separated and numbered OpenAI keys', () => {
    clearAIKeys();
    process.env.OPENAI_API_KEYS = 'sk-proj-a, sk-proj-b';
    process.env.OPENAI_API_KEY_2 = 'sk-proj-d';
    process.env.OPENAI_API_KEY_1 = 'sk-proj-c';

    expect(getOpenAIKeyCandidates()).toEqual([
      'sk-proj-a',
      'sk-proj-b',
      'sk-proj-c',
      'sk-proj-d',
    ]);
  });

  test('accepts Gemini env names only when they contain OpenAI keys', () => {
    clearAIKeys();
    process.env.GEMINI_API_KEY = 'not-openai-key';
    process.env.GEMINI_API_KEYS = 'sk-proj-from-gemini-name';

    expect(getOpenAIKeyCandidates()).toEqual(['sk-proj-from-gemini-name']);
  });
});

describe('getGeminiKeyCandidates', () => {
  const OLD_ENV = process.env;

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test('collects Gemini keys and ignores OpenAI keys in Gemini env vars', () => {
    clearAIKeys();
    process.env.GEMINI_API_KEYS = 'AIza-valid-gemini-key-one-12345, sk-proj-openai';
    process.env.GEMINI_API_KEY_1 = 'AIza-valid-gemini-key-two-12345';

    expect(getGeminiKeyCandidates()).toEqual([
      'AIza-valid-gemini-key-one-12345',
      'AIza-valid-gemini-key-two-12345',
    ]);
  });

  test('reads GOOGLE_API_KEY as Gemini key', () => {
    clearAIKeys();
    process.env.GOOGLE_API_KEY = 'AIza-valid-google-key-one-12345';

    expect(getGeminiKeyCandidates()).toEqual(['AIza-valid-google-key-one-12345']);
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
    process.env.OPENAI_API_KEY = 'invalid-key-format';
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
  test('removes BOM character (\uFEFF) prefix', () => {
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
    process.env.OPENAI_API_KEY = 'bad-key';
    jest.resetModules();
    const mod = require('../geminiService');
    const result = await mod.generateRecommendations(makeParams());
    expect(result).toBeNull();
  });
});
