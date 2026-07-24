const PizZip = require("pizzip");
const fs = require("fs");

const content = fs.readFileSync("C:/Users/muazm/Documents/Lazim Rent Docs/Nima Almahdi Kiray Wel.docx", "binary");
const zip = new PizZip(content);
const xml = zip.file("word/document.xml").asText();
fs.writeFileSync("scratch/document.xml", xml);
console.log("Dumped document.xml");
