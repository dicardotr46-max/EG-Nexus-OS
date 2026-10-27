const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('generateUniqueId', () => {
  let context;

  beforeEach(() => {
    const htmlContent = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf-8');
    const start = htmlContent.indexOf('function generateUniqueId');
    let end = start;
    let braces = 0;
    let foundFirstBrace = false;
    do {
      if (htmlContent[end] === '{') { braces++; foundFirstBrace = true; }
      else if (htmlContent[end] === '}') braces--;
      end++;
    } while ((!foundFirstBrace || braces > 0) && end < htmlContent.length);

    context = vm.createContext({ Date, Math });
    vm.runInContext(`let _nexusIdCounter = 0;\n${htmlContent.substring(start, end)}`, context);
  });

  it('generates unique IDs with proper prefixes', () => {
    const ids = new Set(Array.from({length: 1000}, () => context.generateUniqueId('test')));
    expect(ids.size).toBe(1000);
    expect([...ids].every(id => id.startsWith('test_'))).toBe(true);
    expect(context.generateUniqueId()).toMatch(/^id_\d+_\d+_[a-z0-9]{4}$/);
    expect(context.generateUniqueId('').startsWith('_')).toBe(true);
  });
});
