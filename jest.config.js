module.exports = {
  preset: '@vue/cli-plugin-unit-jest/presets/typescript-and-babel',
  collectCoverageFrom: [
    'src/common/**/*.ts',
    'src/engine/**/*.ts',
    'src/game/**/*.ts',
    'src/stores/**/*.ts',
  ],
};
