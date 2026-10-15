const fs = require('fs');
const pdf = require('pdf-parse');

async function run() {
  const buffer = fs.readFileSync('test.pdf');
  
  const render_page = function(pageData) {
    return pageData.getTextContent({
      normalizeWhitespace: false, 
      disableCombineTextItems: true
    }).then(function(textContent) {
      let text = '';
      for (let item of textContent.items) {
        text += item.str;
      }
      return text;
    });
  };
  
  const pdfData = await pdf(buffer, { pagerender: render_page });
  console.log("Extracted:", pdfData.text);
  console.log("Length:", pdfData.text.length);
  const chars = Array.from(pdfData.text).map(c => c.charCodeAt(0).toString(16));
  console.log("Chars:", chars);
}

run();
