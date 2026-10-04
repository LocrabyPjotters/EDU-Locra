const fs = require('fs');
const pdf = require('pdf-parse');

async function run() {
  const buffer = fs.readFileSync('test.pdf');
  
  const render_page = function(pageData) {
    return pageData.getTextContent({
      normalizeWhitespace: false, 
      disableCombineTextItems: false
    }).then(function(textContent) {
      let text = '';
      for (let item of textContent.items) {
        text += item.str;
      }
      return text;
    });
  };
  
  const pdfData = await pdf(buffer, { pagerender: render_page });
  console.log("Extracted with disableCombineTextItems=false:", pdfData.text);
  console.log("Length:", pdfData.text.length);
  const chars = Array.from(pdfData.text).map(c => c.charCodeAt(0).toString(16));
  console.log("Chars:", chars);
  
  const render_page2 = function(pageData) {
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
  
  const pdfData2 = await pdf(buffer, { pagerender: render_page2 });
  console.log("Extracted with disableCombineTextItems=true:", pdfData2.text);
  console.log("Length:", pdfData2.text.length);
  const chars2 = Array.from(pdfData2.text).map(c => c.charCodeAt(0).toString(16));
  console.log("Chars:", chars2);
}

run();
