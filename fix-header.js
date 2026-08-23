const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const cssFiles = fs.readdirSync(publicDir).filter(f => f.endsWith('.css'));

cssFiles.forEach(file => {
  const filePath = path.join(publicDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. AppHeader height
  content = content.replace(/(\.AppHeader\s*\{[^}]*height:\s*)64px;/g, '$1106px;');
  
  // 2. layout padding-top
  content = content.replace(/(\.layout\s*\{[^}]*padding-top:\s*)64px;/g, '$1106px;');
  
  // 3. SidebarNav top
  content = content.replace(/(\.SidebarNav\s*\{[^}]*top:\s*)64px;/g, '$1106px;');

  // 4. Logo sizing
  content = content.replace(/(height:\s*)42px;/g, '$184px;');
  content = content.replace(/(max-height:\s*)46px;/g, '$192px;');

  fs.writeFileSync(filePath, content);
  console.log(`Updated ${file}`);
});
