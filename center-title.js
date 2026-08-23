const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const cssFiles = fs.readdirSync(publicDir).filter(f => f.endsWith('.css'));

cssFiles.forEach(file => {
  const filePath = path.join(publicDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Regex to match the `.header-title` block.
  // It replaces the first occurrence (which is usually the main one, not media queries)
  // Or globally if we want. Let's do globally but only the exact properties
  
  content = content.replace(
    /\.header-title\s*\{([\s\S]*?)\}/g,
    (match, innerContent) => {
      // Don't modify if it already has position absolute
      if (innerContent.includes('position: absolute')) {
        return match;
      }
      
      // We also only want to apply this to the main desktop block, but doing it in media queries might also work.
      // Actually, if it's mobile, absolute centering might cause overlap. Let's see if we should restrict it.
      // Usually, on mobile, the title is hidden. Let's check meterstatus.css line 809.
      if (innerContent.includes('display: none')) {
        return match; // Keep mobile display:none
      }

      // Add absolute centering
      const newInnerContent = `\n  position: absolute;\n  left: 50%;\n  transform: translateX(-50%);\n  margin: 0;` + innerContent;
      return `.header-title {${newInnerContent}}`;
    }
  );

  fs.writeFileSync(filePath, content);
  console.log(`Updated ${file}`);
});
