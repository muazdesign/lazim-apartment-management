const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');

const inputPath = 'C:\\Users\\muazm\\Documents\\Lazim Rent Docs\\Nima Almahdi Kiray Wel.docx';
const outputDir = 'c:\\apartment-management\\src\\templates';
const outputPath = path.join(outputDir, 'lease-template.docx');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const content = fs.readFileSync(inputPath, 'binary');
const zip = new PizZip(content);

let xml = zip.file('word/document.xml').asText();

const parser = new DOMParser();
const doc = parser.parseFromString(xml, 'text/xml');

const paragraphs = doc.getElementsByTagName('w:p');

const replacements = [
  { search: 'ኒማ አልማህዲ አልአቅብ', replace: '{tenant_name}' },
  { search: 'ኢትዮፕያዊ', replace: '{tenant_citizenship}' },
  { search: 'Assosa Zone ወረዳ አንድ', replace: '{tenant_address_zone}' },
  { search: 'ቤኒሻንጉል ጉሙዝ', replace: '{tenant_address_city}' },
  { search: 'L-301', replace: '{unit_number}' },
  { search: '40000', replace: '{rent_amount}' },
  { search: 'አርባ ሺህ ብር', replace: '{rent_words} ብር' },
  { search: 'ሶስት', replace: '{advance_months_word}' },
  { search: '120000', replace: '{advance_total}' },
  { search: 'መቶ ሃያ ሺህ ብር', replace: '{advance_words} ብር' },
  { search: '15/11/2018', replace: '{start_date}' },
  { search: '15/11/2019', replace: '{end_date}' },
  { search: '1 በመቶኛ', replace: '{late_fee_pct} በመቶኛ' },
  { search: 'ሙአዝ መሀመድ ቶፊቅ', replace: '{witness1_name}' },
  { search: 'አማር መሀመድ ቶፊቅ', replace: '{witness2_name}' }
];

for (let i = 0; i < paragraphs.length; i++) {
  const p = paragraphs[i];
  
  // Get all text content in this paragraph to see if it contains any of our targets
  let pText = '';
  const ts = p.getElementsByTagName('w:t');
  for (let j = 0; j < ts.length; j++) {
    pText += ts[j].textContent;
  }
  
  // If we match any target, rebuild the paragraph's text to make replacements easier
  let needsReplacement = false;
  for (const rep of replacements) {
    if (pText.includes(rep.search)) {
      needsReplacement = true;
      break;
    }
  }
  
  if (needsReplacement) {
    // Collect all w:r elements
    const runs = Array.from(p.getElementsByTagName('w:r'));
    if (runs.length === 0) continue;
    
    // Simplest approach for matching runs: we just want to combine all text into a single run 
    // and remove the others, to avoid split text across runs breaking docxtemplater tags or replacements.
    // However, they might have different formatting.
    // For our specific replacements, they usually occur in text with consistent formatting.
    // Let's just create a new text string by replacing the target text in pText,
    // then put it all in the first run and clear the text of the other runs.
    
    let newText = pText;
    for (const rep of replacements) {
      // For unit_number, there might be 'L- 301' or 'L-301'.
      // We will just do a global replace using split/join to replace all occurrences.
      newText = newText.split(rep.search).join(rep.replace);
    }
    
    // Find the third witness line which is blank and add tag
    if (newText.includes('3. ስም፡-')) {
        newText = newText.replace('3. ስም፡-', '3. ስም፡- {witness3_name}');
    }
    
    // Put new text in the first w:t element of the first run, and empty the rest.
    let firstTFound = false;
    for (const r of runs) {
      const textNodes = Array.from(r.getElementsByTagName('w:t'));
      for (const tNode of textNodes) {
        if (!firstTFound) {
          tNode.textContent = newText;
          tNode.setAttribute('xml:space', 'preserve');
          firstTFound = true;
        } else {
          tNode.textContent = '';
        }
      }
    }
  }
}

const serializer = new XMLSerializer();
const newXml = serializer.serializeToString(doc);

zip.file('word/document.xml', newXml);

const newContent = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
fs.writeFileSync(outputPath, newContent);

console.log('Template prepared successfully at', outputPath);
