const pkg = require('./package.json');
const jestConfig = pkg.jest || {};

module.exports = {
  ...jestConfig,
  testPathIgnorePatterns: [
    '/node_modules/',
    'runtime-dom-wiring\\.test\\.js$',
    'runtime-stress\\.test\\.js$'
  ]
};
