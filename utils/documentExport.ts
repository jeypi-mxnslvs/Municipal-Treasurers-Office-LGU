import { Property, TaxYearRecord } from '../types';

export interface DocumentExportTotals {
  basic: number;
  sef: number;
  grandTotal: number;
}

export interface WordExportOptions {
  documentTitle: string;
  subTitle?: string;
  property: Property;
  records: TaxYearRecord[];
  totals: DocumentExportTotals;
  preparedByName?: string;
  preparedByTitle?: string;
  receivedByName?: string;
  receivedByTitle?: string;
  approvedByName?: string;
  approvedByTitle?: string;
  filename?: string;
  isNoticeOfDelinquency?: boolean;
}

/**
 * Formats currency in standard Philippine Peso format
 */
export const formatPesos = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(val)) return ' -   ';
  return `₱${val.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Generates the canonical Notice of Delinquency CSV content
 * strictly formatted to mirror the Santa Rosa Treasury COMPUTATION.csv template.
 */
export const generateNoticeOfDelinquencyCsv = (
  property: Property,
  records: TaxYearRecord[],
  totals: DocumentExportTotals,
  dateStr?: string
): string => {
  const effectiveDate = dateStr || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const startYear = property.delinquencyStartYear ?? (property.lastPaidYear + 1);

  const lines: string[] = [];
  lines.push('REPUBLIC OF THE PHILIPPINES,,,,,,,,,,,,,,,,,');
  lines.push('PROVINCE OF NUEVA ECIJA,,,,,,,,,,,,,,,,,');
  lines.push('Office of the Treasurer - Municipality of Santa Rosa,,,,,,,,,,,,,,,,,');
  lines.push(',,,,,,,,,,,,,,,,,');
  lines.push('NOTICE OF DELINQUENCY IN THE PAYMENT OF REAL PROPERTY TAX (RA 7160 SEC. 254),,,,,,,,,,,,,,,,,');
  lines.push(',,,,,,,,,,,,,,,,,');
  lines.push(`,,,,,,,OR#,,,,,,Date:,"${effectiveDate.toUpperCase()}",,,`);
  lines.push(',,,,,,,,,,,,,,,,,');
  lines.push(`,,,,,,LAST PAYMENT:,${property.lastPaidYear} (Q${property.lastPaidQuarter || 4}),,,,,,,,,,`);
  lines.push(',"Notice is hereby served pursuant to the provision of Section 254, Republic Act No. 7160 ( Local Government Code of 1991 ) the Real Property Tax for Calendar",,,,,,,,,,,,,,,,');
  lines.push(`"year  ${startYear}  and the previous years, has been delinquent with the respect to the figures.",,,,,,,,,,,,,,,,,`);
  lines.push(',,,,,,,,,,,,,,,,,');
  lines.push('Tax Declaration No.,,Area,Assess Value,Location,,Kind of Property,,,,Year,Unpaid Taxes,,Penalties/Discount,,Total Tax Delinquency,,');
  lines.push(',,,,,,,,,,,,,,,,,');

  records.forEach((r) => {
    const yearLabel = r.periodLabel || String(r.year);
    const isPending = Boolean(r.isMissingValuation || r.isUnverifiedHistorical || r.totalDue === null);
    const unpaidTaxes = isPending || r.baseTax === null ? ' - ' : (r.baseTax / 2).toFixed(2);
    const penaltyOrDiscount = isPending || r.penaltyAmount === null ? ' - ' : ((r.penaltyAmount - (r.discountAmount || 0)) / 2).toFixed(2);
    const totalDelinquency = isPending || r.totalDue === null ? ' - ' : (r.totalDue / 2).toFixed(2);
    const assessedVal = isPending
      ? ' - '
      : (r.assessedValue ?? property.assessedValue).toFixed(2);

    lines.push(
      `"${property.tdNumber}",,"${property.lotAreaSqm || 100}","${assessedVal}","${property.barangay}, Santa Rosa",,"${property.propertyClass}",,,,${yearLabel}, ${unpaidTaxes} ,, ${penaltyOrDiscount} ,, ${totalDelinquency} ,,`
    );
  });

  lines.push(',,,,,,,,,,,,,,,,,');
  lines.push(`,,,,,,,,,,,,,BASIC,,${totals.basic.toFixed(2)},,`);
  lines.push(`,,,,,,,,,,,,,SEF,,${totals.sef.toFixed(2)},,`);
  lines.push(`,,,,,,,,,,,,,TOTAL,,${totals.grandTotal.toFixed(2)},,`);
  lines.push(',,,,,,,,,,,,,,,,,');
  lines.push('Prepared by:,,,,,,,Received by:,,,,,,Approved by:,,,');
  lines.push('Revenue Collection Clerk,,,,,,,Signature over printed name & Date,,,,,,Myra V. Cunanan,,,');
  lines.push(',,,,,,,,,,,,,Municipal Treasurer,,,');

  return lines.join('\n');
};

/**
 * Downloads the generated CSV string as a downloadable file
 */
export const downloadCsvFile = (content: string, filename: string): void => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Generates an MS Word-compliant (.doc) HTML document with official LGU letterhead,
 * high-contrast borders, exact table layout, and signatories.
 */
export const generateWordHtml = (options: WordExportOptions): string => {
  const {
    documentTitle,
    subTitle = 'Pursuant to Section 254, Republic Act No. 7160 (Local Government Code of 1991)',
    property,
    records,
    totals,
    preparedByName = 'Revenue Collection Clerk',
    preparedByTitle = "Municipal Treasurer's Office",
    receivedByName = 'Taxpayer / Authorized Representative',
    receivedByTitle = 'Signature over printed name & Date',
    approvedByName = 'Myra V. Cunanan',
    approvedByTitle = 'Municipal Treasurer',
    isNoticeOfDelinquency = true,
  } = options;

  const dateStr = new Date().toLocaleDateString('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const tableRowsHtml = records.map((r, idx) => {
    const label = r.periodLabel || String(r.year);
    const isPending = Boolean(r.isMissingValuation || r.isUnverifiedHistorical || r.totalDue === null);
    
    // In Notice of Delinquency, columnar values are single fund (1% base = half total)
    const divisor = isNoticeOfDelinquency ? 2 : 1;
    const unpaidTaxes = isPending || r.baseTax === null ? 'Pending RPTAR' : formatPesos(r.baseTax / divisor);
    const penaltyOrDiscount = isPending || r.penaltyAmount === null ? 'Pending RPTAR' : formatPesos((r.penaltyAmount - (r.discountAmount || 0)) / divisor);
    const totalDelinquency = isPending || r.totalDue === null ? 'Pending RPTAR' : formatPesos(r.totalDue / divisor);
    const assessedVal = isPending
      ? 'Pending RPTAR'
      : formatPesos(r.assessedValue ?? property.assessedValue);

    const rowBg = idx % 2 === 1 ? '#f9f9f9' : '#ffffff';

    return `
      <tr style="background-color: ${rowBg};">
        <td style="border: 1pt solid #000000; padding: 4pt 6pt; font-weight: bold; text-align: left;">${label}</td>
        <td style="border: 1pt solid #000000; padding: 4pt 6pt; text-align: right; font-family: 'Courier New', monospace;">${assessedVal}</td>
        <td style="border: 1pt solid #000000; padding: 4pt 6pt; text-align: right; font-family: 'Courier New', monospace;">${unpaidTaxes}</td>
        <td style="border: 1pt solid #000000; padding: 4pt 6pt; text-align: right; font-family: 'Courier New', monospace;">${penaltyOrDiscount}</td>
        <td style="border: 1pt solid #000000; padding: 4pt 6pt; text-align: right; font-family: 'Courier New', monospace; font-weight: bold;">${totalDelinquency}</td>
      </tr>
    `;
  }).join('');

  return `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <title>${documentTitle}</title>
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        @page {
          size: 210mm 297mm; /* A4 Portrait */
          margin: 15mm 15mm 15mm 15mm;
          mso-page-orientation: portrait;
        }
        body {
          font-family: 'Arial', 'Calibri', sans-serif;
          font-size: 10pt;
          line-height: 1.25;
          color: #000000;
          background-color: #ffffff;
        }
        .header-center {
          text-align: center;
          margin-bottom: 12pt;
        }
        .republic {
          font-size: 9pt;
          text-transform: uppercase;
          letter-spacing: 1.5pt;
          margin: 0;
          font-weight: 600;
        }
        .lgu-name {
          font-size: 13pt;
          font-weight: bold;
          text-transform: uppercase;
          margin: 2pt 0;
        }
        .office-name {
          font-size: 10.5pt;
          font-weight: bold;
          color: #065f46;
          text-transform: uppercase;
          margin: 1pt 0;
        }
        .doc-title-badge {
          display: inline-block;
          font-size: 11pt;
          font-weight: bold;
          text-transform: uppercase;
          border: 1.5pt solid #000000;
          padding: 3pt 10pt;
          margin-top: 6pt;
        }
        .sub-clause {
          font-size: 8.5pt;
          font-style: italic;
          color: #333333;
          margin-top: 3pt;
        }
        .meta-table {
          width: 100%;
          border-collapse: collapse;
          margin: 10pt 0;
          font-size: 9pt;
        }
        .meta-table td {
          border: 1pt solid #000000;
          padding: 3pt 6pt;
          vertical-align: top;
        }
        .meta-label {
          font-size: 7.5pt;
          text-transform: uppercase;
          font-weight: bold;
          color: #444444;
          display: block;
        }
        .meta-val {
          font-weight: bold;
          font-size: 9.5pt;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
          margin: 10pt 0;
          font-size: 9pt;
        }
        .data-table th {
          border: 1.5pt solid #000000;
          background-color: #e5e7eb;
          padding: 5pt 6pt;
          font-weight: bold;
          font-size: 8.5pt;
          text-transform: uppercase;
        }
        .footer-totals {
          width: 100%;
          border-collapse: collapse;
          margin-top: 6pt;
          font-size: 9.5pt;
        }
        .footer-totals td {
          border: 1pt solid #000000;
          padding: 4pt 8pt;
        }
        .remedies-box {
          border: 1pt solid #000000;
          padding: 6pt 8pt;
          margin: 12pt 0;
          font-size: 8pt;
          text-align: justify;
          background-color: #fafafa;
        }
        .signatories-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20pt;
          border: none;
        }
        .signatories-table td {
          border: none;
          text-align: center;
          vertical-align: top;
          width: 33.33%;
          padding: 0 10pt;
        }
        .sig-line {
          border-top: 1pt solid #000000;
          margin-top: 35pt;
          padding-top: 3pt;
        }
      </style>
    </head>
    <body>
      <div class="header-center">
        <p class="republic">Republic of the Philippines</p>
        <p class="republic">Province of Nueva Ecija</p>
        <h1 class="lgu-name">Municipality of Santa Rosa</h1>
        <p class="office-name">Office of the Municipal Treasurer</p>
        <div class="doc-title-badge">${documentTitle}</div>
        <p class="sub-clause">${subTitle}</p>
      </div>

      <table class="meta-table">
        <tr>
          <td style="width: 30%;">
            <span class="meta-label">Tax Declaration No. (TDN)</span>
            <span class="meta-val">${property.tdNumber}</span>
          </td>
          <td style="width: 35%;">
            <span class="meta-label">Cadastral PIN / Lot No.</span>
            <span class="meta-val">${property.pin || 'Cadastral Verified'}</span>
          </td>
          <td style="width: 35%;">
            <span class="meta-label">Date Generated</span>
            <span class="meta-val">${dateStr}</span>
          </td>
        </tr>
        <tr>
          <td colspan="2">
            <span class="meta-label">Declared Property Owner</span>
            <span class="meta-val">${property.ownerName}</span>
          </td>
          <td>
            <span class="meta-label">Last Payment Settled</span>
            <span class="meta-val">${property.lastPaidYear} (Q${property.lastPaidQuarter || 4})</span>
          </td>
        </tr>
        <tr>
          <td>
            <span class="meta-label">Property Classification</span>
            <span class="meta-val">${property.propertyClass} (${property.lotAreaSqm || 100} sq.m.)</span>
          </td>
          <td colspan="2">
            <span class="meta-label">Property Location</span>
            <span class="meta-val">${property.address}, Brgy. ${property.barangay}, Santa Rosa, N.E.</span>
          </td>
        </tr>
      </table>

      <table class="data-table">
        <thead>
          <tr>
            <th style="text-align: left; width: 22%;">Assessment Roll Period</th>
            <th style="text-align: right; width: 20%;">Assessed Value (AV)</th>
            <th style="text-align: right; width: 18%;">${isNoticeOfDelinquency ? 'Unpaid Taxes (1% Base)' : 'Basic Tax (1%)'}</th>
            <th style="text-align: right; width: 18%;">Penalties / Surcharges</th>
            <th style="text-align: right; width: 22%;">${isNoticeOfDelinquency ? 'Total Delinquency (Per Fund)' : 'Total Due'}</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>

      <table class="footer-totals">
        <tr>
          <td style="font-weight: bold; text-align: right; width: 70%; text-transform: uppercase;">Basic Real Property Tax (1% General Fund):</td>
          <td style="font-weight: bold; text-align: right; width: 30%; font-family: 'Courier New', monospace;">${formatPesos(totals.basic)}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; text-align: right; text-transform: uppercase;">Special Education Fund (1% Local School Board):</td>
          <td style="font-weight: bold; text-align: right; font-family: 'Courier New', monospace;">${formatPesos(totals.sef)}</td>
        </tr>
        <tr style="background-color: #f3f4f6;">
          <td style="font-weight: bold; font-size: 10.5pt; text-align: right; text-transform: uppercase;">Grand Total Tax Delinquency Payable:</td>
          <td style="font-weight: bold; font-size: 11pt; text-align: right; font-family: 'Courier New', monospace; color: #064e3b;">${formatPesos(totals.grandTotal)}</td>
        </tr>
      </table>

      ${isNoticeOfDelinquency ? `
      <div class="remedies-box">
        <strong>STATUTORY REMEDIES FOR COLLECTION (RA 7160 SEC. 254 / 256):</strong><br>
        Pursuant to Title II, Book II of Republic Act No. 7160, notice is hereby given that failure to pay the delinquent tax and penalty within the statutory demand period will compel the Municipal Treasurer to enforce statutory remedies concurrently or consecutively, including: (1) Administrative levy on real property subject to tax lien; (2) Distraint of personal property; or (3) Public auction sale to satisfy the lien, interest, and costs of sale.
      </div>` : ''}

      <table class="signatories-table">
        <tr>
          <td>
            <div style="font-size: 8pt; font-weight: bold; text-transform: uppercase; color: #555555; margin-bottom: 25pt;">Prepared by:</div>
            <div class="sig-line">
              <strong style="text-transform: uppercase; font-size: 9pt;">${preparedByName}</strong><br>
              <span style="font-size: 8pt; color: #555555;">${preparedByTitle}</span>
            </div>
          </td>
          <td>
            <div style="font-size: 8pt; font-weight: bold; text-transform: uppercase; color: #555555; margin-bottom: 25pt;">Received by:</div>
            <div class="sig-line">
              <strong style="text-transform: uppercase; font-size: 9pt;">${receivedByName}</strong><br>
              <span style="font-size: 8pt; color: #555555;">${receivedByTitle}</span>
            </div>
          </td>
          <td>
            <div style="font-size: 8pt; font-weight: bold; text-transform: uppercase; color: #555555; margin-bottom: 25pt;">Approved by:</div>
            <div class="sig-line">
              <strong style="text-transform: uppercase; font-size: 9.5pt;">${approvedByName}</strong><br>
              <span style="font-size: 8pt; font-weight: bold; color: #065f46; text-transform: uppercase;">${approvedByTitle}</span>
            </div>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

/**
 * Generates and triggers download of a native Microsoft Word (.doc) document
 */
export const downloadWordDoc = (options: WordExportOptions): void => {
  const htmlContent = generateWordHtml(options);
  const filename = options.filename || `${options.documentTitle.replace(/[\s/]/g, '_')}_${options.property.tdNumber}.doc`;

  const blob = new Blob(['\ufeff', htmlContent], {
    type: 'application/msword;charset=utf-8',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
