const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('generateUniqueId', () => {
  let context;

  beforeEach(() => {
    // Read the HTML file
    const htmlContent = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf-8');

    // Extract the script block
    const lines = htmlContent.split('\n');
    let inS = false;
    let start = -1;
    let mainScript = '';

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].trim();
      if (!inS && (l === '<script>' || l.startsWith('<script id='))) {
        inS = true;
        start = i;
      } else if (inS && l === '</script>') {
        const block = lines.slice(start + 1, i).join('\n');
        if (block.includes('function generateUniqueId')) {
          mainScript = block;
          break;
        }
        inS = false;
      }
    }

    if (!mainScript) {
      throw new Error("Could not find the script block with generateUniqueId");
    }

    // Set up a fresh JS context for each test case
    context = vm.createContext({
      Date: Date,
      Math: Math
    });

    // Instead of using brittle regex, we parse out the block by reading matching braces
    // This is safer against minor refactors like adding comments or early returns
    const linesOfScript = mainScript.split('\n');
    let targetCode = '';
    let inTarget = false;
    let targetBraceCount = 0;

    for(let line of linesOfScript) {
      if (line.includes('let _nexusIdCounter =')) {
        targetCode += line + '\n';
      }
      if (line.match(/function\s+generateUniqueId\s*\(/)) {
        inTarget = true;
      }
      if (inTarget) {
        targetCode += line + '\n';
        targetBraceCount += (line.match(/\{/g) || []).length;
        targetBraceCount -= (line.match(/\}/g) || []).length;
        if (targetBraceCount === 0) {
          inTarget = false;
        }
      }
    }

    vm.runInContext(targetCode, context);
  });

  it('should generate unique IDs', () => {
    const id1 = context.generateUniqueId('test');
    const id2 = context.generateUniqueId('test');
    expect(id1).not.toBe(id2);
  });

  it('should start with the correct prefix', () => {
    const id1 = context.generateUniqueId('test');
    expect(id1.startsWith('test_')).toBe(true);

    const id2 = context.generateUniqueId();
    expect(id2.startsWith('id_')).toBe(true);
  });

  it('should increment the counter starting from initial value', () => {
    const id1 = context.generateUniqueId('test');
    const counter1 = parseInt(id1.split('_')[2], 10);

    const id2 = context.generateUniqueId('test');
    const counter2 = parseInt(id2.split('_')[2], 10);

    expect(counter2).toBe((counter1 + 1) % 1000000);
  });

  it('should generate absolutely unique IDs over a large number of calls', () => {
    const ids = new Set();
    const numberOfCalls = 10000;

    for (let i = 0; i < numberOfCalls; i++) {
      ids.add(context.generateUniqueId('bulk'));
    }

    expect(ids.size).toBe(numberOfCalls);
  });

  it('should correctly handle different prefixes in rapid succession', () => {
    const prefixes = ['user', 'msg', 'post', 'comment', 'like'];
    const generatedIds = [];

    for (let i = 0; i < 50; i++) {
      const prefix = prefixes[i % prefixes.length];
      generatedIds.push(context.generateUniqueId(prefix));
    }

    for (let i = 0; i < 50; i++) {
      const expectedPrefix = prefixes[i % prefixes.length];
      expect(generatedIds[i].startsWith(expectedPrefix + '_')).toBe(true);
    }
  });
});
