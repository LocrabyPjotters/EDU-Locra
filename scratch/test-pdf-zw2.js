const fs = require('fs');
const pdf = require('pdf-parse/lib/pdf-parse.js');
const PDFDocument = require('pdfkit');

async function run() {
  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream('test-zw.pdf'));
  
  const secretText = 'Hello\u200BWorld\u200CThis\u200DIs\u2060Secret';
  doc.text(secretText);
  doc.end();
  
  setTimeout(async () => {
    const dataBuffer = fs.readFileSync('test-zw.pdf');
    const data = await pdf(dataBuffer);
    console.log("Default Extracted:", data.text.includes('\u200B'), data.text);
    
    function render_page(pageData) {
        let render_options = {
            normalizeWhitespace: false,
            disableCombineTextItems: false
        }
        return pageData.getTextContent(render_options).then(function(textContent) {
            let lastY, text = '';
            for (let item of textContent.items) {
                if (lastY == item.transform[5] || !lastY){
                    text += item.str;
                } else{
                    text += '\n' + item.str;
                }    
                lastY = item.transform[5];
            }
            return text;
        });
    }

    const data2 = await pdf(dataBuffer, { pagerender: render_page });
    console.log("Custom Extracted includes ZWSP?", data2.text.includes('\u200B'));
  }, 1000);
}
run();
