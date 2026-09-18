import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const htmlContent = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Residential Rental Agreement</title>
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
  .parties {
    margin-bottom: 16px;
  }
</style>
</head>
<body>

<h1>Residential Rental Agreement</h1>

<div class="recital">
This Residential Rental Agreement ("Agreement") is executed on this 1st day of August, 2026, at Bengaluru, Karnataka, by and between:
<br><br>
<strong>Mr. Ramesh Narayan Sharma</strong>, residing at Flat 402, Green Glen Layout, Bellandur, Bengaluru - 560103 (hereinafter referred to as the <strong>"LESSOR"</strong> / <strong>"OWNER"</strong>, which expression shall include his legal heirs, executors, and assigns) of the ONE PART;
<br><br>
AND
<br><br>
<strong>Ms. Ananya Priyadarshini Rao</strong>, having permanent address at H.No. 12/B, Gokulam 3rd Stage, Mysuru - 570002 (hereinafter referred to as the <strong>"LESSEE"</strong> / <strong>"TENANT"</strong>, which expression shall include her legal heirs, executors, and assigns) of the OTHER PART.
</div>

<div class="recital">
WHEREAS the Lessor is the absolute and lawful owner of the residential property situated at Apartment No. 304, Third Floor, Prestige Whispering Palms, Sarjapur Road, Bengaluru - 560035 (hereinafter referred to as the "Scheduled Premises").
</div>

<div class="clause">
<span class="clause-title">Clause 1. Term and Duration:</span> The tenancy shall be for a fixed term of 11 (Eleven) continuous months commencing from 1st August 2026 and expiring on 30th June 2027. Any extension of the tenancy shall be solely subject to mutual written consent of both parties executed at least 30 days prior to the expiration of this Agreement.
</div>

<div class="clause">
<span class="clause-title">Clause 2. Monthly Rent and Maintenance:</span> The Lessee agrees to pay a monthly rent of Rs. 38,000/- (Rupees Thirty-Eight Thousand only) exclusive of society maintenance charges. The rent shall be paid on or before the 5th day of every English calendar month into the Lessor's designated bank account. Any delay beyond the 5th day of the month shall attract a late penalty charge of Rs. 500/- per week of delay.
</div>

<div class="clause">
<span class="clause-title">Clause 3. Security Deposit:</span> The Lessee has paid an interest-free refundable security deposit of Rs. 1,50,000/- (Rupees One Lakh Fifty Thousand only) to the Lessor via RTGS transfer upon signing this Agreement. This deposit shall be refunded to the Lessee within 7 business days of peacefully vacating the Scheduled Premises, subject to deductions for unpaid rent, utility dues, and property damages.
</div>

<div class="clause">
<span class="clause-title">Clause 4. Painting and Maintenance Deductions:</span> At the time of vacating the premises, a mandatory non-negotiable deduction of Rs. 15,000/- (Rupees Fifteen Thousand only) or one month's rent (whichever is lower) shall be retained from the Security Deposit towards professional deep cleaning and repainting of the interior walls.
</div>

<div class="clause">
<span class="clause-title">Clause 5. Lock-in Period and Notice for Termination:</span> Both parties agree to a mandatory Lock-in Period of 6 (six) months, during which neither party can terminate this Agreement. After completion of the lock-in period, either party may terminate the tenancy by serving 2 (two) months' prior written notice or by paying 2 months' rent in lieu thereof. If the Lessee vacates during the lock-in period, the Security Deposit shall stand forfeited up to the extent of the remaining lock-in rent.
</div>

<div class="clause">
<span class="clause-title">Clause 6. Utility and Consumption Charges:</span> The Lessee shall directly bear and promptly pay the monthly electricity consumption charges as billed by BESCOM, piped cooking gas charges, and internet subscription fees as per actual consumption throughout the tenure.
</div>

<div class="clause">
<span class="clause-title">Clause 7. Repairs, Damages, and Indemnity:</span> The Lessee shall maintain the interior fixtures, sanitary fittings, and electrical appliances in tenantable condition. The Lessee shall be liable to compensate the Lessor for any structural damage, glass breakage, or fixture defacement caused by negligence. Minor routine repairs up to Rs. 1,000/- shall be borne by the Lessee, while major structural repairs shall be the Lessor's responsibility.
</div>

<div class="clause">
<span class="clause-title">Clause 8. Prohibited Activities and Subletting:</span> The Lessee covenants that the premises shall be used exclusively for residential purposes only. Subletting, re-letting, assigning, or parting with possession of the premises or any portion thereof to third parties or PG guests is strictly prohibited and shall constitute an incurable material breach.
</div>

<div class="clause">
<span class="clause-title">Clause 9. Immediate Termination and Eviction:</span> If the Lessee fails to pay the monthly rent for 2 (two) consecutive months, or engages in illegal, unlawful, or nuisance activities affecting neighbors, the Lessor reserves the absolute right to terminate this agreement forthwith and re-enter and take possession of the premises without notice.
</div>

<div class="clause">
<span class="clause-title">Clause 10. Governing Law and Jurisdiction:</span> This Agreement shall be governed by and construed in accordance with the Laws of India and the provisions of the Karnataka Rent Act. Any legal disputes arising under this agreement shall be subject exclusively to the civil courts of competent jurisdiction in Bengaluru.
</div>

</body>
</html>
`;

async function main() {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

  const outputDir = path.resolve('samples');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const pdfPath = path.join(outputDir, 'sample_rental_agreement.pdf');
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
    printBackground: true,
  });

  console.log('Sample Indian Rental Agreement PDF generated at:', pdfPath);
  await browser.close();
}

main().catch(console.error);
