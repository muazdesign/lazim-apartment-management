const fs = require('fs');
const PizZip = require('pizzip');
const { DOMParser } = require('@xmldom/xmldom');

const inputPath = 'C:\\Users\\muazm\\Documents\\Lazim Rent Docs\\Nima Almahdi Kiray Wel.docx';
const content = fs.readFileSync(inputPath, 'binary');
const zip = new PizZip(content);
const xml = zip.file('word/document.xml').asText();
const doc = new DOMParser().parseFromString(xml, 'text/xml');

const paragraphs = doc.getElementsByTagName('w:p');
for (let i = 0; i < paragraphs.length; i++) {
  const p = paragraphs[i];
  let pText = '';
  const ts = p.getElementsByTagName('w:t');
  for (let j = 0; j < ts.length; j++) {
    pText += ts[j].textContent;
  }
  if (pText.includes('ሙአዝ') || pText.includes('አማር') || pText.includes('3')) {
     console.log(pText);
  }
}
