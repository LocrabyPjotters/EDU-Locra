const PDFDocument = require('pdfkit');
const fs = require('fs');

const doc = new PDFDocument();
doc.pipe(fs.createWriteStream('test.pdf'));
doc.text('Hello \u200B\u200CWorld!');
doc.end();
