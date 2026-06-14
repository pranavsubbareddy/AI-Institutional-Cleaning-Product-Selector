module.exports = {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.[jt]sx?$': '<rootDir>/transform.cjs',
    '^.+\\.mjs$': '<rootDir>/transform.cjs',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(@google/genai|p-retry|node-fetch|data-uri-to-buffer|fetch-blob|formdata-polyfill)/)',
  ],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.cjs',
  },
  testPathIgnorePatterns: [
    '/node_modules/',
  ],
};
