import QRCode from "qrcode";

export interface BatchTimelineUpdate {
  timestamp: string | number;
  stage: string;
  location?: string;
  updatedBy?: string;
  actor?: string;
  temperature?: number;
  humidity?: number;
  txHash?: string;
  notes?: string;
}

export interface ExportableBatch {
  id?: string;
  batchId?: string;
  cropType: string;
  farmerName?: string;
  farmerAddress?: string;
  origin: string;
  quantity: string | number;
  unit?: string;
  harvestDate: string;
  status?: string;
  currentStage?: string;
  certifications?: string;
  description?: string;
  updates?: BatchTimelineUpdate[];
}

/**
 * Generates and triggers download of a CSV supply chain data file
 */
export function generateBatchCSVString(batch: ExportableBatch): string {
  const headers = [
    "Batch ID",
    "Crop Type",
    "Farmer Name",
    "Farmer Address",
    "Origin",
    "Quantity",
    "Harvest Date",
    "Status",
    "Current Stage",
    "Certifications",
    "Description",
  ];

  const id = batch.batchId || batch.id || "N/A";
  const row = [
    `"${id}"`,
    `"${batch.cropType || ""}"`,
    `"${batch.farmerName || ""}"`,
    `"${batch.farmerAddress || ""}"`,
    `"${batch.origin || ""}"`,
    `"${batch.quantity || ""}"`,
    `"${batch.harvestDate || ""}"`,
    `"${batch.status || ""}"`,
    `"${batch.currentStage || ""}"`,
    `"${batch.certifications || ""}"`,
    `"${batch.description || ""}"`,
  ];

  let csvContent = headers.join(",") + "\n" + row.join(",") + "\n\n";

  csvContent += "--- SUPPLY CHAIN TIMELINE STAGES ---\n";
  csvContent += "Timestamp,Stage,Location,Actor,Temperature (C),Humidity (%),Tx Hash,Notes\n";

  if (batch.updates && batch.updates.length > 0) {
    batch.updates.forEach((update) => {
      const updateRow = [
        `"${update.timestamp ? new Date(update.timestamp).toLocaleString() : ""}"`,
        `"${update.stage || ""}"`,
        `"${update.location || ""}"`,
        `"${update.updatedBy || update.actor || ""}"`,
        `"${update.temperature !== undefined ? update.temperature : ""}"`,
        `"${update.humidity !== undefined ? update.humidity : ""}"`,
        `"${update.txHash || ""}"`,
        `"${update.notes || ""}"`,
      ];
      csvContent += updateRow.join(",") + "\n";
    });
  } else {
    csvContent += "No stage updates recorded yet.\n";
  }

  return csvContent;
}

export function exportBatchToCSV(batch: ExportableBatch): void {
  const csvContent = generateBatchCSVString(batch);
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const filename = `CropChain_Batch_${batch.batchId || batch.id || "export"}.csv`;

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Generates an HTML report string formatted for printing/saving as PDF
 */
export async function generateBatchPDFHTML(batch: ExportableBatch): Promise<string> {
  const id = batch.batchId || batch.id || "N/A";
  const verificationUrl = typeof window !== "undefined"
    ? `${window.location.origin}/track-batch?id=${id}`
    : `https://cropchain.io/track-batch?id=${id}`;

  let qrDataUrl = "";
  try {
    qrDataUrl = await QRCode.toDataURL(verificationUrl, { width: 160, margin: 1 });
  } catch (err) {
    console.error("Failed to generate QR code for PDF export:", err);
  }

  const updatesRows = (batch.updates || [])
    .map(
      (u, idx) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${idx + 1}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${u.timestamp ? new Date(u.timestamp).toLocaleString() : "N/A"}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold; text-transform: capitalize;">${u.stage || "N/A"}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${u.location || "N/A"}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${u.updatedBy || u.actor || "N/A"}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${u.temperature ? u.temperature + "°C" : "N/A"} / ${u.humidity ? u.humidity + "%" : "N/A"}</td>
    </tr>`
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>CropChain Provenance Certificate - ${id}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; color: #1f2937; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #16a34a; padding-bottom: 20px; }
          .title { color: #16a34a; margin: 0; font-size: 24px; font-weight: bold; }
          .subtitle { color: #4b5563; font-size: 14px; margin-top: 4px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0; background: #f9fafb; padding: 20px; border-radius: 8px; }
          .field-label { font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: bold; }
          .field-value { font-size: 15px; font-weight: 600; color: #111827; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; text-align: left; font-size: 13px; }
          th { background: #f3f4f6; padding: 10px; border-bottom: 2px solid #d1d5db; font-size: 12px; text-transform: uppercase; }
          .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 20px; }
          @media print {
            body { margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">🌱 CropChain Provenance Certificate</h1>
            <div class="subtitle">Official Supply Chain Journey Summary</div>
          </div>
          ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR Code" width="100" height="100" />` : ""}
        </div>

        <div class="grid">
          <div>
            <div class="field-label">Batch ID</div>
            <div class="field-value">${id}</div>
          </div>
          <div>
            <div class="field-label">Crop Type</div>
            <div class="field-value">${batch.cropType || "N/A"}</div>
          </div>
          <div>
            <div class="field-label">Farmer Name</div>
            <div class="field-value">${batch.farmerName || "N/A"}</div>
          </div>
          <div>
            <div class="field-label">Origin Location</div>
            <div class="field-value">${batch.origin || "N/A"}</div>
          </div>
          <div>
            <div class="field-label">Quantity</div>
            <div class="field-value">${batch.quantity} ${batch.unit || "kg"}</div>
          </div>
          <div>
            <div class="field-label">Harvest Date</div>
            <div class="field-value">${batch.harvestDate || "N/A"}</div>
          </div>
        </div>

        <h3 style="color: #111827; margin-top: 30px;">Supply Chain Verification Timeline</h3>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Timestamp</th>
              <th>Stage</th>
              <th>Location</th>
              <th>Verified Actor</th>
              <th>Telemetry</th>
            </tr>
          </thead>
          <tbody>
            ${updatesRows || '<tr><td colspan="6" style="padding: 12px; text-align: center; color: #9ca3af;">No stage updates recorded yet.</td></tr>'}
          </tbody>
        </table>

        <div class="footer">
          Generated via CropChain Decentralized Agricultural Supply Chain System • Scan QR code to verify on-chain provenance.
        </div>
      </body>
    </html>
  `;
}

export async function exportBatchToPDF(batch: ExportableBatch): Promise<void> {
  const htmlContent = await generateBatchPDFHTML(batch);
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  }
}
