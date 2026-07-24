const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const fs = require("fs");
const path = require("path");

try {
  const templatePath = path.join("c:\\apartment-management", "public", "templates", "lease-template.docx");
  const content = fs.readFileSync(templatePath, "binary");
  const zip = new PizZip(content);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  doc.render({
      tenant_name: "Test Tenant",
      tenant_citizenship: "Test Citizenship",
      tenant_address_zone: "Zone",
      tenant_address_city: "City",
      unit_number: "L-123",
      rent_amount: 1000,
      rent_words: "One thousand",
      advance_months_word: "Three",
      advance_total: 3000,
      advance_words: "Three thousand",
      start_date: "01/01/2026",
      end_date: "01/01/2027",
      late_fee_pct: 1,
      witness1_name: "W1",
      witness2_name: "W2",
      witness3_name: "W3"
  });
  console.log("Success");
} catch (e) {
  console.error(e);
}
