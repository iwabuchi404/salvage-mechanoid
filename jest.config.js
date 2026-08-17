module.exports = {
  preset: '@vue/cli-plugin-unit-jest/presets/typescript-and-babel',
  testMatch: [
    '**/tests/unit/**/*.spec.[jt]s?(x)',
    '**/tests/integration/**/*.spec.[jt]s?(x)',
    '**/__tests__/*.[jt]s?(x)',
  ],
  collectCoverageFrom: [
    'src/common/**/*.ts',
    'src/engine/**/*.ts',
    'src/game/**/*.ts',
    'src/stores/**/*.ts',
  ],
};
