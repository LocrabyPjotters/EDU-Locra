const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'client/src/pages/chat/ChatLayout.tsx');
let content = fs.readFileSync(file, 'utf8');

// Find the onClick handler that opens the plus menu and change it to open file dialog directly
content = content.replace(
  /onClick=\{.*?setShowPlusMenu\(!showPlusMenu\).*?\}\s*\n\s*className="btn btn-ghost"\s*\n\s*style=\{\{ width: '38px', height: '38px', padding: 0, borderRadius: '50%', flexShrink: 0, color: 'var\(--text-secondary\)', transition: 'transform 0\.2s', transform: showPlusMenu \? 'rotate\(45deg\)' : 'rotate\(0deg\)' \}\}/,
  `onClick={() => fileInputRef.current?.click()}\r\n                    className="btn btn-ghost" \r\n                    style={{ width: '38px', height: '38px', padding: 0, borderRadius: '50%', flexShrink: 0, color: 'var(--text-secondary)' }}`
);

// Change the title
content = content.replace(
  'title="Extra opties"',
  'title="Bestand toevoegen"'
);

fs.writeFileSync(file, content);
console.log("Done! Plus button now opens file dialog directly.");
