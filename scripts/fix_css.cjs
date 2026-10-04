const fs = require('fs');
const files = [
  "/Users/p.oosterling/Site/Pjotters/RowMatch 2.0/Locra/apps/locra-website/src/App.css",
  "/Users/p.oosterling/Site/Pjotters/RowMatch 2.0/Locra/apps/locra-edu/src/App.css"
];

for (const file of files) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    // We add background-clip: text; below -webkit-background-clip: text; if it's missing
    content = content.replace(/-webkit-background-clip:\s*text;/g, "-webkit-background-clip: text;\n  background-clip: text;");
    // Ensure we don't duplicate it
    content = content.replace(/background-clip:\s*text;\s*background-clip:\s*text;/g, "background-clip: text;");
    fs.writeFileSync(file, content);
    console.log("Fixed CSS in: " + file);
  } else {
    console.log("File not found: " + file);
  }
}
