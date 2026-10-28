// Compile with tsc first: Nest DI requires emitted decorator metadata.
const shared = {
  testEnvironment: 'node',
  transform: {},
  clearMocks: true,
  restoreMocks: true,
  setupFilesAfterEnv: ['<rootDir>/dist-tests/tests/backend/setup.js'],
  testTimeout: 15000,
};

export default {
  projects: [
    { ...shared, displayName: 'unit', testMatch: ['<rootDir>/dist-tests/tests/backend/**/*.spec.js'] },
    { ...shared, displayName: 'integration', testMatch: ['<rootDir>/dist-tests/tests/backend/**/*.e2e-spec.js'] },
  ],
};
