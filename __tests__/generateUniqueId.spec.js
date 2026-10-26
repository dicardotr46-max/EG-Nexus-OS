const fs = require('fs');
const vm = require('vm');

describe('generateUniqueId', () => {
  it('tests uniqueness and prefix handling', () => {
    const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
    const start = html.indexOf('function generateUniqueId');
    let braces = 0, i = start, end = -1;
    while (i < html.length) {
      if (html[i] === '{') braces++;
      if (html[i] === '}') { braces--; if (braces === 0) { end = i + 1; break; } }
      i++;
    }
    const fnBody = html.slice(start, end);
    const sandbox = { _nexusIdCounter: 0, Date, Math };
    vm.createContext(sandbox);
    vm.runInContext(fnBody, sandbox);

    const id1 = sandbox.generateUniqueId('tst');
    const id2 = sandbox.generateUniqueId('tst');

    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^tst_\d+_\d+_[a-z0-9]{4}$/);
    expect(id2).toMatch(/^tst_\d+_\d+_[a-z0-9]{4}$/);

    const id3 = sandbox.generateUniqueId();
    expect(id3).toMatch(/^id_\d+_\d+_[a-z0-9]{4}$/);
  });
});
