const fs = require('fs');

const files = ['settings.js', 'grid.js', 'building.js', 'meterstatus.js'];

files.forEach((f) => {
  const filepath = './public/' + f;
  if (!fs.existsSync(filepath)) return;
  const content = fs.readFileSync(filepath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    // Look for style=" or style=' in HTM template strings
    if (line.includes('style="') || line.includes("style='")) {
      console.log(`${f}:${idx + 1}: ${line.trim()}`);
    }
  });
});
