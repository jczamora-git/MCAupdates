const fs = require('fs');
const file = './src/components/ChatbotWidget.tsx';
let content = fs.readFileSync(file, 'utf8');

// Find Campus Companion header line and show what comes after
const idx = content.indexOf('Campus Companion');
const snippet = content.substring(idx, idx + 25);
console.log('RAW snippet:', JSON.stringify(snippet));

// Replace any garbled sequence after "Campus Companion" (up to a < or newline or quote)
// The garbled bytes for ✨ (U+2728) when stored as latin1-misread UTF8 are: â œ ¨
// In JS string read as utf8, garbled sequence looks like: \u00e2\u009c\u00a8
// But the file might contain various combinations - just replace whole header text
const newContent = content.replace(
  /Campus Companion [^\n<"]+/g,
  'Campus Companion \u2728'
);

if (newContent === content) {
  console.log('No change made');
} else {
  fs.writeFileSync(file, newContent, 'utf8');
  console.log('File updated successfully');
  // Verify
  const updated = fs.readFileSync(file, 'utf8');
  const idx2 = updated.indexOf('Campus Companion');
  console.log('After fix:', JSON.stringify(updated.substring(idx2, idx2 + 25)));
}
