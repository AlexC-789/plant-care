/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  maxWorkers: '50%',
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/e2e/'],
};
