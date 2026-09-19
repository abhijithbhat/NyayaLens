import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const htmlContent = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Residential Rental Agreement (Revised Version B)</title>
<style>
  body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 13px;
    line-height: 1.6;
    color: #111;
    margin: 40px 50px;
  }
  h1 {
    text-align: center;
    font-size: 18px;
    text-transform: uppercase;
    margin-bottom: 20px;
    letter-spacing: 1px;
    text-decoration: underline;
  }
  .recital {
    margin-bottom: 16px;
    text-align: justify;
  }
  .clause {
    margin-bottom: 14px;
    text-align: justify;
  }
  .clause-title {
    font-weight: bold;
    text-decoration: underline;
  }
</style>
</head>
<body>

<h1>Residential Rental Agreement</h1>

<div class="recital">
This Residential Rental Agreement ("Agreement") is executed on this 1st day of August, 2026, at Bengaluru, Karnataka, by and between:
<br><br>
<strong>Mr. Ramesh Narayan Sharma</strong>, residing at Flat 402, Green Glen Layout, Bellandur, Bengaluru - 560103 (hereinafter referred to as the <strong>"LESSOR"</strong> / <strong>"OWNER"</strong>) of the ONE PART;
<br><br>
AND
<br><br>
<strong>Ms. Ananya Priyadarshini Rao</strong>, residing at H.No. 12/B, Gokulam 3rd Stage, Mysuru - 570002 (hereinafter referred to as the <strong>"LESSEE"</strong> / <strong>"TENANT"</strong>) of the OTHER PART.
</div>

<div class="recital">
WHEREAS the Lessor is the absolute and lawful owner of the residential property situated at Apartment No. 304, Third Floor, Prestige Whispering Palms, Sarjapur Road, Bengaluru - 560035 (hereinafter referred to as the "Scheduled Premises").
</div>

<div class="clause">
<span class="clause-title">Clause 1. Term and Duration:</span> The tenancy shall be for a fixed term of 11 (Eleven) continuous months commencing from 1st August 2026 and expiring on 30th June 2027. Any extension shall be subject to mutual written consent of both parties executed at least 30 days prior to expiration.
</div>

<div class="clause">
<span class="clause-title">Clause 2. Monthly Rent and Maintenance:</span> The Lessee agrees to pay a monthly rent of Rs. 42,000/- (Rupees Forty-Two Thousand only) exclusive of society maintenance charges. The rent shall be paid on or before the 5th day of every English calendar month into the Lessor's designated bank account. Any delay beyond the 5th day of the month shall attract a late penalty charge of Rs. 1,000/- per week of delay.
</div>

<div class="clause">
<span class="clause-title">Clause 3. Security Deposit:</span> The Lessee has paid an interest-free refundable security deposit of Rs. 2,00,000/- (Rupees Two Lakhs only) to the Lessor via RTGS transfer upon signing this Agreement. This deposit shall be refunded to the Lessee within 15 business days of peacefully vacating the Scheduled Premises, subject to deductions for unpaid rent and utility dues.
</div>

<!-- Note: Clause 4 (Painting and Maintenance Deductions) from Document A is deliberately omitted here in Document B -->

<div class="clause">
<span class="clause-title">Clause 4. Lock-in Period and Notice for Termination:</span> Both parties agree to a Lock-in Period of 3 (three) months, during which neither party can terminate this Agreement. After completion of the lock-in period, either party may terminate the tenancy by serving 1 (one) month's prior written notice or by paying 1 month's rent in lieu thereof.
</div>

<div class="clause">
<span class="clause-title">Clause 5. Utility and Consumption Charges:</span> The Lessee shall directly bear and promptly pay the monthly electricity consumption charges as billed by BESCOM, piped cooking gas charges, and internet subscription fees as per actual consumption throughout the tenure.
</div>

<div class="clause">
<span class="clause-title">Clause 6. Repairs, Damages, and Indemnity:</span> The Lessee shall maintain the interior fixtures, sanitary fittings, and electrical appliances in tenantable condition. Minor routine repairs up to Rs. 1,000/- shall be borne by the Lessee, while major structural repairs shall be the Lessor's responsibility.
</div>

<div class="clause">
<span class="clause-title">Clause 7. Prohibited Activities and Subletting:</span> The Lessee covenants that the premises shall be used exclusively for residential purposes only. Subletting, re-letting, assigning, or parting with possession of the premises to third parties is strictly prohibited.
</div>

<div class="clause">
<span class="clause-title">Clause 8. Immediate Termination and Eviction:</span> If the Lessee fails to pay the monthly rent for 2 (two) consecutive months, or engages in illegal activities, the Lessor reserves the right to terminate this agreement forthwith and re-enter and take possession of the premises.
</div>

<div class="clause">
<span class="clause-title">Clause 9. Governing Law and Jurisdiction:</span> This Agreement shall be governed by and construed in accordance with the Laws of India and the provisions of the Karnataka Rent Act. Any legal disputes shall be subject exclusively to the civil courts of competent jurisdiction in Bengaluru.
</div>

<div class="clause">
<span class="clause-title">Clause 10. Pet Policy and Animal Regulations:</span> Keeping of any domestic animals or pets, including dogs, cats, or birds, within the Scheduled Premises is strictly prohibited under all circumstances without exception. Any unauthorized keeping of pets will lead to immediate lease cancellation and a penalty of Rs. 25,000/-.
</div>

</body>
</html>
`;

import os from 'os';

async function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nyaya_v2_'));
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', `--user-data-dir=${tempDir}`],
  });

  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

  const outputDir = path.resolve('samples');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const pdfPath = path.join(outputDir, 'sample_rental_agreement_v2.pdf');
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
    printBackground: true,
  });

  console.log('Sample Indian Rental Agreement V2 PDF generated at:', pdfPath);
  await browser.close();
}

main().catch(console.error);
