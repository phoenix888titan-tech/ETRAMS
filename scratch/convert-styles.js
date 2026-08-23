const fs = require('fs');

function cssStyleToObjectString(styleStr) {
  const rules = styleStr.split(';').map((r) => r.trim()).filter(Boolean);
  const objEntries = rules
    .map((rule) => {
      const colonIdx = rule.indexOf(':');
      if (colonIdx === -1) return '';
      const prop = rule.substring(0, colonIdx).trim();
      const val = rule.substring(colonIdx + 1).trim();
      const camelProp = prop.replace(/-([a-z])/g, (_, g1) => g1.toUpperCase());
      // Handle values containing single quotes if any
      const safeVal = val.replace(/'/g, "\\'");
      return `${camelProp}: '${safeVal}'`;
    })
    .filter(Boolean);
  return `style=\${{ ${objEntries.join(', ')} }}`;
}

function processFile(filename) {
  const filepath = './public/' + filename;
  if (!fs.existsSync(filepath)) return;
  let content = fs.readFileSync(filepath, 'utf8');

  // Match style="..." or style='...'
  // regex: style="([^"]*)"
  let modified = content.replace(/style="([^"]*)"/g, (match, p1) => {
    return cssStyleToObjectString(p1);
  });

  modified = modified.replace(/style='([^']*)'/g, (match, p1) => {
    return cssStyleToObjectString(p1);
  });

  fs.writeFileSync(filepath, modified, 'utf8');
  console.log(`Converted style strings in ${filename}`);
}

['settings.js', 'grid.js', 'building.js', 'meterstatus.js'].forEach(processFile);
