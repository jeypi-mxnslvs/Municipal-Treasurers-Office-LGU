import { Property, TaxYearRecord, OfficialReceipt } from '../types';

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

  const tableRowsHtml = records.map((r) => {
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

    return `
      <tr>
        <td style="border: 1pt solid #000000; padding: 4pt 6pt; font-weight: normal; text-align: left; color: #000000; font-family: 'Times New Roman', Times, serif;">${label}</td>
        <td style="border: 1pt solid #000000; padding: 4pt 6pt; font-weight: normal; text-align: right; color: #000000; font-family: 'Times New Roman', Times, serif;">${assessedVal}</td>
        <td style="border: 1pt solid #000000; padding: 4pt 6pt; font-weight: normal; text-align: right; color: #000000; font-family: 'Times New Roman', Times, serif;">${unpaidTaxes}</td>
        <td style="border: 1pt solid #000000; padding: 4pt 6pt; font-weight: normal; text-align: right; color: #000000; font-family: 'Times New Roman', Times, serif;">${penaltyOrDiscount}</td>
        <td style="border: 1pt solid #000000; padding: 4pt 6pt; font-weight: normal; text-align: right; color: #000000; font-family: 'Times New Roman', Times, serif;">${totalDelinquency}</td>
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
          font-family: 'Times New Roman', Times, serif;
          font-size: 11pt;
          line-height: 1.25;
          color: #000000;
          background-color: #ffffff;
        }
        table, th, td, p, div, span, h1, h2, h3 {
          font-family: 'Times New Roman', Times, serif !important;
        }
        .header-center {
          text-align: center;
          margin-bottom: 12pt;
          color: #000000;
        }
        .republic {
          font-size: 9.5pt;
          text-transform: uppercase;
          letter-spacing: 1.5pt;
          margin: 0;
          font-weight: normal;
          color: #000000;
        }
        .lgu-name {
          font-size: 13pt;
          font-weight: bold;
          text-transform: uppercase;
          margin: 2pt 0;
          color: #000000;
        }
        .office-name {
          font-size: 10.5pt;
          font-weight: normal;
          color: #000000;
          text-transform: uppercase;
          margin: 1pt 0;
        }
        .doc-title-badge {
          display: inline-block;
          font-size: 11pt;
          font-weight: bold;
          text-transform: uppercase;
          border: 1pt solid #000000;
          padding: 3pt 10pt;
          margin-top: 6pt;
          background-color: #ffffff;
          color: #000000;
        }
        .sub-clause {
          font-size: 9pt;
          font-style: italic;
          color: #000000;
          margin-top: 3pt;
        }
        .meta-table {
          width: 100%;
          border-collapse: collapse;
          margin: 10pt 0;
          font-size: 9.5pt;
        }
        .meta-table td {
          border: 1pt solid #000000;
          padding: 3pt 6pt;
          vertical-align: top;
          font-weight: normal;
          color: #000000;
          background-color: #ffffff;
        }
        .meta-label {
          font-size: 8pt;
          text-transform: uppercase;
          font-weight: normal;
          color: #000000;
          display: block;
        }
        .meta-val {
          font-weight: normal;
          font-size: 9.5pt;
          color: #000000;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
          margin: 10pt 0;
          font-size: 9.5pt;
        }
        .data-table th {
          border: 1pt solid #000000;
          background-color: #ffffff;
          padding: 5pt 6pt;
          font-weight: normal;
          font-size: 9.5pt;
          text-transform: uppercase;
          color: #000000;
        }
        .data-table td {
          font-weight: normal;
          color: #000000;
          background-color: #ffffff;
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
          font-weight: normal;
          color: #000000;
          background-color: #ffffff;
        }
        .remedies-box {
          border: 1pt solid #000000;
          padding: 6pt 8pt;
          margin: 12pt 0;
          font-size: 8.5pt;
          text-align: justify;
          background-color: #ffffff;
          color: #000000;
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
          font-weight: normal;
          color: #000000;
          background-color: #ffffff;
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
          <td style="text-align: right; width: 70%; text-transform: uppercase;">Basic Real Property Tax (1% General Fund):</td>
          <td style="text-align: right; width: 30%;">${formatPesos(totals.basic)}</td>
        </tr>
        <tr>
          <td style="text-align: right; text-transform: uppercase;">Special Education Fund (1% Local School Board):</td>
          <td style="text-align: right;">${formatPesos(totals.sef)}</td>
        </tr>
        <tr>
          <td style="text-align: right; text-transform: uppercase;">Grand Total Tax Delinquency Payable:</td>
          <td style="text-align: right;">${formatPesos(totals.grandTotal)}</td>
        </tr>
      </table>

      ${isNoticeOfDelinquency ? `
      <div class="remedies-box">
        STATUTORY REMEDIES FOR COLLECTION (RA 7160 SEC. 254 / 256):<br>
        Pursuant to Title II, Book II of Republic Act No. 7160, notice is hereby given that failure to pay the delinquent tax and penalty within the statutory demand period will compel the Municipal Treasurer to enforce statutory remedies concurrently or consecutively, including: (1) Administrative levy on real property subject to tax lien; (2) Distraint of personal property; or (3) Public auction sale to satisfy the lien, interest, and costs of sale.
      </div>` : ''}

      <table class="signatories-table">
        <tr>
          <td>
            <div style="font-size: 8pt; text-transform: uppercase; color: #000000; margin-bottom: 25pt;">Prepared by:</div>
            <div class="sig-line">
              <div style="text-transform: uppercase; font-size: 9pt;">${preparedByName}</div>
              <div style="font-size: 8pt; color: #000000;">${preparedByTitle}</div>
            </div>
          </td>
          <td>
            <div style="font-size: 8pt; text-transform: uppercase; color: #000000; margin-bottom: 25pt;">Received by:</div>
            <div class="sig-line">
              <div style="text-transform: uppercase; font-size: 9pt;">${receivedByName}</div>
              <div style="font-size: 8pt; color: #000000;">${receivedByTitle}</div>
            </div>
          </td>
          <td>
            <div style="font-size: 8pt; text-transform: uppercase; color: #000000; margin-bottom: 25pt;">Approved by:</div>
            <div class="sig-line">
              <div style="text-transform: uppercase; font-size: 9.5pt;">${approvedByName}</div>
              <div style="font-size: 8pt; text-transform: uppercase;">${approvedByTitle}</div>
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

/**
 * Generates an official Accountable Form No. 51 Tax Clearance Slip & Ledger CSV
 */
export const generateReceiptCsv = (receipt: OfficialReceipt): string => {
  const isVoided = receipt.status === 'VOIDED';
  const issuedDate = new Date(receipt.date).toLocaleString('en-PH');
  const records = receipt.itemizedRecords || [];
  const lines: string[] = [];

  lines.push('REPUBLIC OF THE PHILIPPINES,,,,,,');
  lines.push('PROVINCE OF NUEVA ECIJA,,,,,,');
  lines.push('OFFICE OF THE MUNICIPAL TREASURER & ASSESSOR - SANTA ROSA,,,,,,');
  lines.push(',,,,,,');
  lines.push('OFFICIAL REAL PROPERTY TAX CLEARANCE SLIP & LEDGER,,,,,,');
  lines.push(`ACCOUNTABLE FORM NO. 51 REF:,"${receipt.receiptNo}",,,,,`);
  lines.push(`DATE & TIME ISSUED:,"${issuedDate}",,,,,`);
  lines.push(`STATUS:,"${isVoided ? 'VOIDED / CANCELLED (COA)' : 'OFFICIALLY ISSUED (RA 7160)'}",,,,,`);
  if (isVoided) {
    lines.push(`CANCELLATION REASON:,"${receipt.voidReason || 'Supervisory Cancellation'}",,,,,`);
    lines.push(`VOIDED BY:,"${receipt.voidedBy || 'Administrator'}",,,,,`);
    lines.push(`VOIDED AT:,"${receipt.voidedAt ? new Date(receipt.voidedAt).toLocaleString('en-PH') : 'Recorded'}",,,,,`);
  }
  lines.push(',,,,,,');
  lines.push('PROPERTY DETAILS,,,,,,');
  lines.push(`Tax Declaration No. (TDN):,"${receipt.property.tdNumber}",,,,,`);
  lines.push(`Property Index No. (PIN):,"${receipt.property.pin || 'NOT SPECIFIED'}",,,,,`);
  lines.push(`Declared Owner:,"${receipt.property.ownerName}",,,,,`);
  lines.push(`Location:,"${receipt.property.address}, Brgy. ${receipt.property.barangay}, Santa Rosa",,,,,`);
  lines.push(`Classification:,"${receipt.property.propertyClass}",,,,,`);
  lines.push(`Assessed Valuation:,${receipt.property.assessedValue.toFixed(2)},,,,,`);
  lines.push(',,,,,,');
  lines.push('Tax Period / Year,Basic Tax (1%),SEF Tax (1%),Penalty (2%/mo),Discount,Subtotal');

  records.forEach((rec) => {
    const period = rec.periodLabel || String(rec.year);
    const basic = (rec.basicTax ?? (rec.baseTax !== null ? rec.baseTax / 2 : 0)) || 0;
    const sef = (rec.sefTax ?? (rec.baseTax !== null ? rec.baseTax / 2 : 0)) || 0;
    const penalty = rec.penaltyAmount || 0;
    const discount = rec.discountAmount || 0;
    const totalDue = rec.totalDue || 0;

    lines.push(`"${period}",${basic.toFixed(2)},${sef.toFixed(2)},${penalty.toFixed(2)},${discount.toFixed(2)},${totalDue.toFixed(2)}`);
  });

  const summary = receipt.summary || {
    basicTax: 0,
    sefTax: 0,
    penalty: 0,
    discount: 0,
    totalPaid: 0,
  };

  lines.push(',,,,,,');
  lines.push(`Grand Totals:,${summary.basicTax.toFixed(2)},${summary.sefTax.toFixed(2)},${summary.penalty.toFixed(2)},${summary.discount.toFixed(2)},${summary.totalPaid.toFixed(2)}`);
  lines.push(',,,,,,');
  lines.push(`COMPLIANCE VERIFICATION:,"${isVoided ? 'CANCELLED / VOIDED UNDER COA PROTOCOLS' : 'OFFICIALLY CLEARED UNDER RA 7160'}",,,,,`);
  lines.push('"This document certifies that statutory Real Property Tax liabilities and Special Education Fund (SEF) levies for the periods listed above have been audited and officially recorded in the municipal tax ledger.",,,,,,');
  lines.push(',,,,,,');
  lines.push('Assessed & Recorded By:,,,,Approved & Certified By:,,');
  lines.push(`"${receipt.postedBy}",,,,OFFICE OF THE MUNICIPAL TREASURER,,`);
  lines.push('Assessor / Clearance Officer,,,,Municipality of Santa Rosa,,');

  return lines.join('\n');
};

/**
 * Generates an MS Word-compliant (.doc) HTML document for the Official Receipt / Clearance Slip
 */
export const generateReceiptWordHtml = (receipt: OfficialReceipt): string => {
  const isVoided = receipt.status === 'VOIDED';
  const issuedDate = new Date(receipt.date).toLocaleString('en-PH');
  const records = receipt.itemizedRecords || [];

  const summary = receipt.summary || {
    basicTax: 0,
    sefTax: 0,
    penalty: 0,
    discount: 0,
    totalPaid: 0,
  };

  const tableRowsHtml = records.map((rec) => {
    const period = rec.periodLabel || String(rec.year);
    const basic = (rec.basicTax ?? (rec.baseTax !== null ? rec.baseTax / 2 : 0)) || 0;
    const sef = (rec.sefTax ?? (rec.baseTax !== null ? rec.baseTax / 2 : 0)) || 0;
    const penalty = rec.penaltyAmount || 0;
    const discount = rec.discountAmount || 0;
    const totalDue = rec.totalDue || 0;

    return `
      <tr>
        <td style="border: 1pt solid #000000; padding: 4pt 6pt; font-weight: normal; text-align: left; color: #000000; font-family: 'Times New Roman', Times, serif;">${period}</td>
        <td style="border: 1pt solid #000000; padding: 4pt 6pt; font-weight: normal; text-align: right; color: #000000; font-family: 'Times New Roman', Times, serif;">${formatPesos(basic)}</td>
        <td style="border: 1pt solid #000000; padding: 4pt 6pt; font-weight: normal; text-align: right; color: #000000; font-family: 'Times New Roman', Times, serif;">${formatPesos(sef)}</td>
        <td style="border: 1pt solid #000000; padding: 4pt 6pt; font-weight: normal; text-align: right; color: #000000; font-family: 'Times New Roman', Times, serif;">${penalty > 0 ? formatPesos(penalty) : ' - '}</td>
        <td style="border: 1pt solid #000000; padding: 4pt 6pt; font-weight: normal; text-align: right; color: #000000; font-family: 'Times New Roman', Times, serif;">${discount > 0 ? `-${formatPesos(discount)}` : ' - '}</td>
        <td style="border: 1pt solid #000000; padding: 4pt 6pt; font-weight: normal; text-align: right; color: #000000; font-family: 'Times New Roman', Times, serif;">${formatPesos(totalDue)}</td>
      </tr>
    `;
  }).join('');

  return `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <title>Official Receipt Clearance Slip - ${receipt.receiptNo}</title>
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
          font-family: 'Times New Roman', Times, serif;
          font-size: 11pt;
          line-height: 1.25;
          color: #000000;
          background-color: #ffffff;
        }
        table, th, td, p, div, span, h1, h2, h3 {
          font-family: 'Times New Roman', Times, serif !important;
        }
        .header-center {
          text-align: center;
          margin-bottom: 12pt;
          color: #000000;
        }
        .republic {
          font-size: 9.5pt;
          text-transform: uppercase;
          letter-spacing: 1.5pt;
          margin: 0;
          font-weight: normal;
          color: #000000;
        }
        .lgu-name {
          font-size: 13pt;
          font-weight: bold;
          text-transform: uppercase;
          margin: 2pt 0;
          color: #000000;
        }
        .office-name {
          font-size: 10.5pt;
          font-weight: normal;
          color: #000000;
          text-transform: uppercase;
          margin: 1pt 0;
        }
        .doc-title-badge {
          display: inline-block;
          font-size: 11pt;
          font-weight: bold;
          text-transform: uppercase;
          border: 1pt solid #000000;
          padding: 3pt 10pt;
          margin-top: 6pt;
          background-color: #ffffff;
          color: #000000;
        }
        .sub-clause {
          font-size: 9pt;
          font-style: italic;
          color: #000000;
          margin-top: 3pt;
        }
        .meta-table {
          width: 100%;
          border-collapse: collapse;
          margin: 10pt 0;
          font-size: 9.5pt;
        }
        .meta-table td {
          border: 1pt solid #000000;
          padding: 3pt 6pt;
          vertical-align: top;
          font-weight: normal;
          color: #000000;
          background-color: #ffffff;
        }
        .meta-label {
          font-size: 8pt;
          text-transform: uppercase;
          font-weight: normal;
          color: #000000;
          display: block;
        }
        .meta-val {
          font-weight: normal;
          font-size: 9.5pt;
          color: #000000;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
          margin: 10pt 0;
          font-size: 9.5pt;
        }
        .data-table th {
          border: 1pt solid #000000;
          background-color: #ffffff;
          padding: 5pt 6pt;
          font-weight: normal;
          font-size: 9.5pt;
          text-transform: uppercase;
          color: #000000;
        }
        .data-table td {
          font-weight: normal;
          color: #000000;
          background-color: #ffffff;
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
          font-weight: normal;
          color: #000000;
          background-color: #ffffff;
        }
        .cert-box {
          border: 1pt solid #000000;
          padding: 6pt 8pt;
          margin: 10pt 0;
          font-size: 8.5pt;
          background-color: #ffffff;
          color: #000000;
        }
        .void-banner {
          border: 1pt solid #000000;
          background-color: #ffffff;
          color: #000000;
          padding: 6pt 10pt;
          text-align: center;
          margin-bottom: 10pt;
          font-size: 9.5pt;
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
          width: 50%;
          padding: 0 15pt;
          font-weight: normal;
          color: #000000;
          background-color: #ffffff;
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
        <p class="office-name">Office of the Municipal Treasurer & Assessor</p>
        <div class="doc-title-badge">OFFICIAL REAL PROPERTY TAX CLEARANCE SLIP & LEDGER</div>
        <p class="sub-clause">Official Accountable Form No. 51 Tax Ledger Slip (Republic Act No. 7160)</p>
      </div>

      ${isVoided ? `
      <div class="void-banner">
        *** OFFICIAL RECEIPT VOIDED & CANCELLED (COA AUDIT PROTOCOL) ***<br>
        <span style="font-size: 8.5pt; color: #000000;">
          Reason: ${receipt.voidReason || 'Supervisory Cancellation'} | 
          Authorized by: ${receipt.voidedBy || 'Administrator'} | 
          Date Voided: ${receipt.voidedAt ? new Date(receipt.voidedAt).toLocaleString('en-PH') : 'Recorded'}
        </span>
      </div>` : ''}

      <table class="meta-table">
        <tr>
          <td style="width: 50%;">
            <span class="meta-label">Accountable Form No. 51 Ref:</span>
            <span class="meta-val">${receipt.receiptNo}</span>
          </td>
          <td style="width: 50%;">
            <span class="meta-label">Date & Time Issued:</span>
            <span class="meta-val">${issuedDate}</span>
          </td>
        </tr>
        <tr>
          <td>
            <span class="meta-label">Tax Declaration No. (TDN):</span>
            <span class="meta-val">${receipt.property.tdNumber}</span>
          </td>
          <td>
            <span class="meta-label">Property Index No. (PIN):</span>
            <span class="meta-val">${receipt.property.pin || 'NOT SPECIFIED'}</span>
          </td>
        </tr>
        <tr>
          <td>
            <span class="meta-label">Declared Owner:</span>
            <span class="meta-val">${receipt.property.ownerName}</span>
          </td>
          <td>
            <span class="meta-label">Location of Property:</span>
            <span class="meta-val">${receipt.property.address}, Brgy. ${receipt.property.barangay}</span>
          </td>
        </tr>
        <tr>
          <td>
            <span class="meta-label">Classification:</span>
            <span class="meta-val">${receipt.property.propertyClass}</span>
          </td>
          <td>
            <span class="meta-label">Assessed Valuation:</span>
            <span class="meta-val">${formatPesos(receipt.property.assessedValue)}</span>
          </td>
        </tr>
      </table>

      <table class="data-table">
        <thead>
          <tr>
            <th style="text-align: left; width: 22%;">Tax Period / Year</th>
            <th style="text-align: right; width: 16%;">Basic Tax (1%)</th>
            <th style="text-align: right; width: 16%;">SEF Tax (1%)</th>
            <th style="text-align: right; width: 16%;">Penalty (2%/mo)</th>
            <th style="text-align: right; width: 14%;">Discount</th>
            <th style="text-align: right; width: 16%;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
        <tfoot>
          <tr>
            <td style="border: 1pt solid #000000; padding: 4pt 6pt; font-size: 8.5pt; text-transform: uppercase;">Grand Totals:</td>
            <td style="border: 1pt solid #000000; padding: 4pt 6pt; text-align: right;">${formatPesos(summary.basicTax)}</td>
            <td style="border: 1pt solid #000000; padding: 4pt 6pt; text-align: right;">${formatPesos(summary.sefTax)}</td>
            <td style="border: 1pt solid #000000; padding: 4pt 6pt; text-align: right;">${formatPesos(summary.penalty)}</td>
            <td style="border: 1pt solid #000000; padding: 4pt 6pt; text-align: right;">${formatPesos(summary.discount)}</td>
            <td style="border: 1pt solid #000000; padding: 4pt 6pt; text-align: right;">${formatPesos(summary.totalPaid)}</td>
          </tr>
        </tfoot>
      </table>

      <div class="cert-box">
        COMPLIANCE VERIFICATION: ${isVoided ? 'STATUS: CANCELLED / VOIDED (COA)' : 'STATUS: OFFICIALLY CLEARED (RA 7160)'}<br>
        <span style="font-size: 8.5pt; color: #000000;">
          ${isVoided
            ? 'This Official Receipt has been revoked by the Municipal Treasury Supervisor under Commission on Audit (COA) cancellation protocols. Historical tax liability has been reverted.'
            : 'This document certifies that statutory Real Property Tax liabilities and Special Education Fund (SEF) levies for the periods listed above have been audited and officially updated as CLEARED in the municipal tax ledger.'}
        </span>
      </div>

      <table class="signatories-table">
        <tr>
          <td>
            <div style="font-size: 8pt; text-transform: uppercase; color: #000000; margin-bottom: 25pt;">Assessed & Recorded By:</div>
            <div class="sig-line">
              <div style="text-transform: uppercase; font-size: 9pt;">${receipt.postedBy}</div>
              <div style="font-size: 8pt; color: #000000;">Assessor / Clearance Officer</div>
            </div>
          </td>
          <td>
            <div style="font-size: 8pt; text-transform: uppercase; color: #000000; margin-bottom: 25pt;">Approved & Certified By:</div>
            <div class="sig-line">
              <div style="text-transform: uppercase; font-size: 9.5pt;">OFFICE OF THE MUNICIPAL TREASURER</div>
              <div style="font-size: 8pt; text-transform: uppercase;">Municipality of Santa Rosa</div>
            </div>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

/**
 * Generates and triggers download of a native Microsoft Word (.doc) Clearance Slip
 */
export const downloadReceiptWordDoc = (receipt: OfficialReceipt, filename?: string): void => {
  const htmlContent = generateReceiptWordHtml(receipt);
  const targetFilename = filename || `Clearance_Slip_${receipt.receiptNo}_${receipt.property.tdNumber}.doc`;

  const blob = new Blob(['\ufeff', htmlContent], {
    type: 'application/msword;charset=utf-8',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', targetFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Downloads generated content as an Excel (.xls) file
 */
export const downloadXlsFile = (content: string, filename: string): void => {
  const blob = new Blob(['\ufeff', content], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
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

/**
 * Generates an Excel-compliant (.xls) HTML spreadsheet matching the canonical
 * Santa Rosa Municipal Treasurer RPT COMPUTATION.xls layout from official records.
 */
export const generateNoticeOfDelinquencyXlsHtml = (
  property: Property,
  records: TaxYearRecord[],
  totals: DocumentExportTotals,
  dateStr?: string
): string => {
  const now = new Date();
  const monthNames = [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
  ];
  const currentMonth = monthNames[now.getMonth()];
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentYear = now.getFullYear();
  const dayRange = `01-${lastDay}`;
  const startYear = property.delinquencyStartYear ?? (property.lastPaidYear + 1);

  const tableRowsHtml = records.map((r, idx) => {
    const yearLabel = r.periodLabel || String(r.year);
    const isPending = Boolean(r.isMissingValuation || r.isUnverifiedHistorical || r.totalDue === null);
    const unpaidTaxesVal = isPending || r.baseTax === null ? ' - ' : (r.baseTax / 2).toFixed(2);
    
    const diff = (r.penaltyAmount || 0) - (r.discountAmount || 0);
    let penaltyOrDiscountVal = ' - ';
    let penaltyColor = '#000000';
    if (!isPending && r.penaltyAmount !== null) {
      if (diff > 0) {
        penaltyOrDiscountVal = (diff / 2).toFixed(2);
        penaltyColor = '#ff0000';
      } else if (diff < 0) {
        penaltyOrDiscountVal = (Math.abs(diff) / 2).toFixed(2);
        penaltyColor = '#00b0f0';
      }
    }
    const totalDelinquencyVal = isPending || r.totalDue === null ? ' - ' : (r.totalDue / 2).toFixed(2);

    const tdCell = idx === 0 ? property.tdNumber : '';
    const areaCell = idx === 0 ? String(property.lotAreaSqm || 100) : '';
    const avCell = idx === 0 ? property.assessedValue.toFixed(2) : (r.assessedValue && r.assessedValue !== property.assessedValue ? r.assessedValue.toFixed(2) : '');
    const locCell = idx === 0 ? `${property.barangay}, Santa Rosa` : '';
    const classCell = idx === 0 ? property.propertyClass : '';

    return `
      <tr style="height: 16pt;">
        <td style="border: 1pt solid #000000; text-align: center; mso-number-format: '\\@';">${tdCell}</td>
        <td style="border: 1pt solid #000000; text-align: center;">${areaCell}</td>
        <td style="border: 1pt solid #000000; text-align: right; mso-number-format: '\\#\\,\\#\\#0\\.00';">${avCell}</td>
        <td style="border: 1pt solid #000000; text-align: center;">${locCell}</td>
        <td style="border: 1pt solid #000000; text-align: center;">${classCell}</td>
        <td style="border: 1pt solid #000000;"></td>
        <td style="border: 1pt solid #000000; text-align: center; font-weight: bold; mso-number-format: '\\@';">${yearLabel}</td>
        <td style="border: 1pt solid #000000; text-align: right; mso-number-format: '\\#\\,\\#\\#0\\.00';">${unpaidTaxesVal}</td>
        <td style="border: 1pt solid #000000; text-align: right; color: ${penaltyColor}; mso-number-format: '\\#\\,\\#\\#0\\.00';">${penaltyOrDiscountVal}</td>
        <td style="border: 1pt solid #000000; text-align: right; mso-number-format: '\\#\\,\\#\\#0\\.00';">${totalDelinquencyVal}</td>
      </tr>
    `;
  }).join('');

  return `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>${currentMonth.slice(0, 3)} ${currentYear}</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
                <x:Print>
                  <x:ValidPrinterInfo/>
                  <x:PaperSizeIndex>9</x:PaperSizeIndex>
                  <x:HorizontalResolution>600</x:HorizontalResolution>
                  <x:VerticalResolution>600</x:VerticalResolution>
                </x:Print>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        body { font-family: Arial, sans-serif; font-size: 10pt; }
        table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 10pt; }
        td, th { vertical-align: middle; }
      </style>
    </head>
    <body>
      <table border="0" cellspacing="0" cellpadding="2">
        <tr style="height: 20pt;"><td colspan="10" align="center" style="font-weight: bold; font-size: 11pt;">REPUBLIC OF THE PHILIPPINES</td></tr>
        <tr style="height: 18pt;"><td colspan="10" align="center" style="font-weight: bold; font-size: 10pt;">PROVINCE OF NUEVA ECIJA</td></tr>
        <tr style="height: 18pt;"><td colspan="10" align="center" style="font-weight: bold; font-size: 10pt;">Office of the Treasurer</td></tr>
        <tr style="height: 10pt;"><td colspan="10"></td></tr>
        <tr style="height: 20pt;"><td colspan="10" align="center" style="font-weight: bold; font-size: 11pt;">NOTICE OF DELIQUENCY IN THE PAYMENT OF REAL PROPERTY TAX IN THE</td></tr>
        <tr style="height: 10pt;"><td colspan="10"></td></tr>
        <tr style="height: 20pt;">
          <td colspan="4"></td>
          <td colspan="2" align="center" style="font-weight: bold; font-size: 10pt;">OR #</td>
          <td></td>
          <td align="right" style="font-weight: bold; font-size: 10pt;">Date:</td>
          <td colspan="2" align="center" style="font-weight: bold; font-size: 10pt;">${dateStr ? dateStr.toUpperCase() : `${currentMonth} <font color="red">${dayRange}</font> ${currentYear}`}</td>
        </tr>
        <tr style="height: 20pt;">
          <td colspan="4"></td>
          <td colspan="2" align="center" style="font-weight: bold; font-size: 9.5pt;">LAST PAYMENT: ${property.lastPaidYear} (Q${property.lastPaidQuarter || 4})</td>
          <td colspan="4"></td>
        </tr>
        <tr style="height: 10pt;"><td colspan="10"></td></tr>
        <tr style="height: 18pt;">
          <td colspan="10" style="font-size: 9.5pt;">&nbsp;&nbsp;&nbsp;&nbsp;Notice is hereby served pursuant to the provision of Section 254, Republic Act No. 7160 ( Local Government Code of 1991 ) the Real Property Tax for Calendar</td>
        </tr>
        <tr style="height: 18pt;">
          <td colspan="10" style="font-size: 9.5pt;">year &nbsp;<u>&nbsp;&nbsp;<b>${startYear}</b>&nbsp;&nbsp;</u>&nbsp; and the previous years, has been delinquent with the respect to the figures.</td>
        </tr>
        <tr style="height: 8pt;"><td colspan="10"></td></tr>
        
        <!-- Table Header (Row 10) -->
        <tr style="height: 25pt; font-weight: bold; text-align: center; font-size: 9.5pt;">
          <td style="border: 1.5pt solid #000000; width: 120pt;">Tax Declaration No.</td>
          <td style="border: 1.5pt solid #000000; width: 60pt;">Area</td>
          <td style="border: 1.5pt solid #000000; width: 75pt;">Assess<br/>Value</td>
          <td style="border: 1.5pt solid #000000; width: 120pt;">Location</td>
          <td style="border: 1.5pt solid #000000; width: 95pt;">Kind of Property</td>
          <td style="border: 1.5pt solid #000000; width: 25pt;"></td>
          <td style="border: 1.5pt solid #000000; width: 75pt;">Year</td>
          <td style="border: 1.5pt solid #000000; width: 85pt;">Unpaid Taxes</td>
          <td style="border: 1.5pt solid #000000; width: 105pt;"><font color="red">Penalties</font> /<font color="#00b0f0">Discount</font></td>
          <td style="border: 1.5pt solid #000000; width: 110pt;">Total Tax Delinquency</td>
        </tr>

        <!-- Table Data Rows -->
        ${tableRowsHtml}

        <!-- Summary Totals Rows -->
        <tr style="height: 18pt;">
          <td style="border: 1pt solid #000000;"></td>
          <td style="border: 1pt solid #000000;"></td>
          <td style="border: 1pt solid #000000;"></td>
          <td style="border: 1pt solid #000000;"></td>
          <td style="border: 1pt solid #000000;"></td>
          <td style="border: 1pt solid #000000;"></td>
          <td style="border: 1pt solid #000000;"></td>
          <td style="border: 1pt solid #000000;"></td>
          <td align="center" style="border: 1.5pt solid #000000; font-weight: bold;">BASIC</td>
          <td align="right" style="border: 1.5pt solid #000000; font-weight: bold; mso-number-format: '\\#\\,\\#\\#0\\.00';">${totals.basic > 0 ? totals.basic.toFixed(2) : ' - '}</td>
        </tr>
        <tr style="height: 18pt;">
          <td style="border: 1pt solid #000000;"></td>
          <td style="border: 1pt solid #000000;"></td>
          <td style="border: 1pt solid #000000;"></td>
          <td style="border: 1pt solid #000000;"></td>
          <td style="border: 1pt solid #000000;"></td>
          <td style="border: 1pt solid #000000;"></td>
          <td style="border: 1pt solid #000000;"></td>
          <td style="border: 1pt solid #000000;"></td>
          <td align="center" style="border: 1.5pt solid #000000; font-weight: bold;">SEF</td>
          <td align="right" style="border: 1.5pt solid #000000; font-weight: bold; mso-number-format: '\\#\\,\\#\\#0\\.00';">${totals.sef > 0 ? totals.sef.toFixed(2) : ' - '}</td>
        </tr>
        <tr style="height: 18pt;">
          <td style="border: 1pt solid #000000;"></td>
          <td style="border: 1pt solid #000000;"></td>
          <td style="border: 1pt solid #000000;"></td>
          <td style="border: 1pt solid #000000;"></td>
          <td style="border: 1pt solid #000000;"></td>
          <td style="border: 1pt solid #000000;"></td>
          <td style="border: 1pt solid #000000;"></td>
          <td style="border: 1pt solid #000000;"></td>
          <td align="center" style="border: 1.5pt solid #000000; font-weight: bold;">TOTAL</td>
          <td align="right" style="border: 1.5pt solid #000000; font-weight: bold; mso-number-format: '\\#\\,\\#\\#0\\.00'; color: ${totals.grandTotal > 0 ? '#000000' : 'red'};">${totals.grandTotal > 0 ? totals.grandTotal.toFixed(2) : ' - '}</td>
        </tr>

        <!-- Signatures Spacer -->
        <tr style="height: 20pt;"><td colspan="10"></td></tr>

        <!-- Signatories Header Row -->
        <tr style="height: 16pt;">
          <td colspan="3" style="font-size: 9pt;">Prepared by:</td>
          <td></td>
          <td colspan="3" style="font-size: 9pt;">Received by:</td>
          <td></td>
          <td colspan="2" align="center" style="font-size: 9.5pt; font-weight: bold;">Myra V. Cunanan</td>
        </tr>

        <!-- Signatures Underlines & Titles -->
        <tr style="height: 22pt;">
          <td colspan="3" align="center" style="border-top: 1pt solid #000000; font-size: 9pt;">Revenue Collection Clerk</td>
          <td></td>
          <td colspan="3" align="center" style="border-top: 1pt solid #000000; font-size: 9pt;">Signature over printed name & Date</td>
          <td></td>
          <td colspan="2" align="center" style="border-top: 1pt solid #000000; font-size: 9pt; font-weight: bold;">Municipal Treasurer</td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

/**
 * Downloads Notice of Delinquency in native Excel (.xls) format matching the Santa Rosa template
 */
export const downloadNoticeOfDelinquencyXls = (
  property: Property,
  records: TaxYearRecord[],
  totals: DocumentExportTotals,
  filename?: string
): void => {
  const htmlContent = generateNoticeOfDelinquencyXlsHtml(property, records, totals);
  const targetFilename = filename || `COMPUTATION_${property.tdNumber}.xls`;
  downloadXlsFile(htmlContent, targetFilename);
};

/**
 * Generates an Excel-compliant (.xls) HTML spreadsheet for the Official Receipt / Clearance Slip
 */
export const generateReceiptXlsHtml = (receipt: OfficialReceipt): string => {
  const isVoided = receipt.status === 'VOIDED';
  const issuedDate = new Date(receipt.date).toLocaleString('en-PH');
  const records = receipt.itemizedRecords || [];

  const summary = receipt.summary || {
    basicTax: 0,
    sefTax: 0,
    penalty: 0,
    discount: 0,
    totalPaid: 0,
  };

  const tableRowsHtml = records.map((rec) => {
    const period = rec.periodLabel || String(rec.year);
    const basic = (rec.basicTax ?? (rec.baseTax !== null ? rec.baseTax / 2 : 0)) || 0;
    const sef = (rec.sefTax ?? (rec.baseTax !== null ? rec.baseTax / 2 : 0)) || 0;
    const penalty = rec.penaltyAmount || 0;
    const discount = rec.discountAmount || 0;
    const totalDue = rec.totalDue || 0;

    return `
      <tr style="height: 18pt;">
        <td style="border: 1pt solid #000000; text-align: center; font-weight: bold; mso-number-format: '\\@';">${period}</td>
        <td style="border: 1pt solid #000000; text-align: right; mso-number-format: '\\#\\,\\#\\#0\\.00';">${basic.toFixed(2)}</td>
        <td style="border: 1pt solid #000000; text-align: right; mso-number-format: '\\#\\,\\#\\#0\\.00';">${sef.toFixed(2)}</td>
        <td style="border: 1pt solid #000000; text-align: right; color: ${penalty > 0 ? 'red' : '#000000'}; mso-number-format: '\\#\\,\\#\\#0\\.00';">${penalty > 0 ? penalty.toFixed(2) : ' - '}</td>
        <td style="border: 1pt solid #000000; text-align: right; color: ${discount > 0 ? '#00b0f0' : '#000000'}; mso-number-format: '\\#\\,\\#\\#0\\.00';">${discount > 0 ? `-${discount.toFixed(2)}` : ' - '}</td>
        <td style="border: 1pt solid #000000; text-align: right; font-weight: bold; mso-number-format: '\\#\\,\\#\\#0\\.00';">${totalDue.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  return `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>CLEARANCE_SLIP</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        body { font-family: Arial, sans-serif; font-size: 10pt; }
        table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 10pt; }
        td, th { vertical-align: middle; }
      </style>
    </head>
    <body>
      <table border="0" cellspacing="0" cellpadding="2">
        <tr style="height: 20pt;"><td colspan="6" align="center" style="font-weight: bold; font-size: 11pt;">REPUBLIC OF THE PHILIPPINES</td></tr>
        <tr style="height: 18pt;"><td colspan="6" align="center" style="font-weight: bold; font-size: 10pt;">PROVINCE OF NUEVA ECIJA</td></tr>
        <tr style="height: 18pt;"><td colspan="6" align="center" style="font-weight: bold; font-size: 10pt;">OFFICE OF THE MUNICIPAL TREASURER & ASSESSOR - SANTA ROSA</td></tr>
        <tr style="height: 10pt;"><td colspan="6"></td></tr>
        <tr style="height: 20pt;"><td colspan="6" align="center" style="font-weight: bold; font-size: 11pt;">OFFICIAL REAL PROPERTY TAX CLEARANCE SLIP & LEDGER</td></tr>
        <tr style="height: 16pt;"><td colspan="6" align="center" style="font-size: 9pt;">Accountable Form No. 51 Tax Ledger Slip (RA 7160)</td></tr>
        <tr style="height: 10pt;"><td colspan="6"></td></tr>

        <!-- Metadata Matrix -->
        <tr style="height: 18pt;">
          <td colspan="3" style="border: 1pt solid #000000; font-size: 9pt;"><b>AF-51 Ref:</b> ${receipt.receiptNo}</td>
          <td colspan="3" style="border: 1pt solid #000000; font-size: 9pt;"><b>Date & Time:</b> ${issuedDate}</td>
        </tr>
        <tr style="height: 18pt;">
          <td colspan="3" style="border: 1pt solid #000000; font-size: 9pt;"><b>Tax Declaration No.:</b> ${receipt.property.tdNumber}</td>
          <td colspan="3" style="border: 1pt solid #000000; font-size: 9pt;"><b>Property Index No.:</b> ${receipt.property.pin || 'NOT SPECIFIED'}</td>
        </tr>
        <tr style="height: 18pt;">
          <td colspan="3" style="border: 1pt solid #000000; font-size: 9pt;"><b>Owner:</b> ${receipt.property.ownerName}</td>
          <td colspan="3" style="border: 1pt solid #000000; font-size: 9pt;"><b>Location:</b> ${receipt.property.address}, Brgy. ${receipt.property.barangay}</td>
        </tr>
        <tr style="height: 18pt;">
          <td colspan="3" style="border: 1pt solid #000000; font-size: 9pt;"><b>Classification:</b> ${receipt.property.propertyClass}</td>
          <td colspan="3" style="border: 1pt solid #000000; font-size: 9pt;"><b>Assessed Value:</b> ₱${receipt.property.assessedValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
        </tr>
        <tr style="height: 10pt;"><td colspan="6"></td></tr>

        <!-- Table Header -->
        <tr style="height: 22pt; font-weight: bold; text-align: center; font-size: 9.5pt;">
          <td style="border: 1.5pt solid #000000; width: 110pt;">Tax Period / Year</td>
          <td style="border: 1.5pt solid #000000; width: 90pt;">Basic Tax (1%)</td>
          <td style="border: 1.5pt solid #000000; width: 90pt;">SEF Tax (1%)</td>
          <td style="border: 1.5pt solid #000000; width: 90pt;">Penalty (2%/mo)</td>
          <td style="border: 1.5pt solid #000000; width: 90pt;">Discount</td>
          <td style="border: 1.5pt solid #000000; width: 100pt;">Subtotal</td>
        </tr>

        <!-- Data Rows -->
        ${tableRowsHtml}

        <!-- Grand Totals -->
        <tr style="height: 20pt; font-weight: bold;">
          <td align="center" style="border: 1.5pt solid #000000; font-size: 9pt;">Grand Totals:</td>
          <td align="right" style="border: 1.5pt solid #000000; mso-number-format: '\\#\\,\\#\\#0\\.00';">${summary.basicTax.toFixed(2)}</td>
          <td align="right" style="border: 1.5pt solid #000000; mso-number-format: '\\#\\,\\#\\#0\\.00';">${summary.sefTax.toFixed(2)}</td>
          <td align="right" style="border: 1.5pt solid #000000; mso-number-format: '\\#\\,\\#\\#0\\.00'; color: ${summary.penalty > 0 ? 'red' : '#000000'};">${summary.penalty > 0 ? summary.penalty.toFixed(2) : ' - '}</td>
          <td align="right" style="border: 1.5pt solid #000000; mso-number-format: '\\#\\,\\#\\#0\\.00'; color: ${summary.discount > 0 ? '#00b0f0' : '#000000'};">${summary.discount > 0 ? `-${summary.discount.toFixed(2)}` : ' - '}</td>
          <td align="right" style="border: 1.5pt solid #000000; font-size: 10pt; mso-number-format: '\\#\\,\\#\\#0\\.00';">${summary.totalPaid.toFixed(2)}</td>
        </tr>

        <tr style="height: 12pt;"><td colspan="6"></td></tr>

        <!-- Compliance Box -->
        <tr style="height: 22pt;">
          <td colspan="6" style="border: 1pt solid #000000; font-size: 9pt; padding: 4pt;">
            <b>COMPLIANCE VERIFICATION:</b> ${isVoided ? 'STATUS: CANCELLED / VOIDED (COA PROTOCOL)' : 'STATUS: OFFICIALLY CLEARED (RA 7160)'}<br/>
            ${isVoided ? 'This receipt has been revoked under supervisory authorization.' : 'This document certifies that statutory RPT and SEF liabilities have been audited and officially updated as CLEARED.'}
          </td>
        </tr>

        <tr style="height: 20pt;"><td colspan="6"></td></tr>

        <!-- Signatories -->
        <tr style="height: 16pt;">
          <td colspan="3" style="font-size: 9pt;">Assessed & Recorded By:</td>
          <td colspan="3" style="font-size: 9pt;">Approved & Certified By:</td>
        </tr>
        <tr style="height: 20pt;">
          <td colspan="3" align="center" style="border-top: 1pt solid #000000; font-size: 9pt;">${receipt.postedBy}<br/><span style="font-size: 8pt;">Assessor / Clearance Officer</span></td>
          <td colspan="3" align="center" style="border-top: 1pt solid #000000; font-size: 9pt; font-weight: bold;">OFFICE OF THE MUNICIPAL TREASURER<br/><span style="font-size: 8pt; font-weight: normal;">Municipality of Santa Rosa</span></td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

/**
 * Downloads Clearance Slip in native Excel (.xls) format
 */
export const downloadReceiptXls = (
  receipt: OfficialReceipt,
  filename?: string
): void => {
  const htmlContent = generateReceiptXlsHtml(receipt);
  const targetFilename = filename || `Clearance_Slip_${receipt.receiptNo}_${receipt.property.tdNumber}.xls`;
  downloadXlsFile(htmlContent, targetFilename);
};

