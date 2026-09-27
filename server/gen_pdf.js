const PDFDocument = require('pdfkit');
const fs = require('fs');

async function run() {
  const doc = new PDFDocument();
  const writeStream = fs.createWriteStream('test.pdf');
  doc.pipe(writeStream);
  doc.text('Hello \u200B\u200CWorld!');
  doc.end();

  await new Promise(resolve => writeStream.on('finish', resolve));
  console.log("PDF written successfully");
}
run();
