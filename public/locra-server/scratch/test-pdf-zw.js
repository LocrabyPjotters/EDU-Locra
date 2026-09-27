const fs = require('fs');
const pdf = require('pdf-parse');
const PDFDocument = require('pdfkit');

async function run() {
  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream('test-zw.pdf'));
  
  // ZWSPs: \u200B \u200C \u200D \u2060
  const secretText = 'Hello\u200BWorld\u200CThis\u200DIs\u2060Secret';
  doc.text(secretText);
  doc.end();
  
  setTimeout(async () => {
    const dataBuffer = fs.readFileSync('test-zw.pdf');
    const data = await pdf(dataBuffer);
    console.log("Extracted:", data.text);
    console.log("Includes ZWSP 200B?", data.text.includes('\u200B'));
    console.log("Length original:", secretText.length, "Extracted:", data.text.trim().length);
  }, 1000);
}
run();
