const PDFDocument = require("pdfkit");

class PDFService {
  async generateBatchJourneyPDF(batch) {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const buffers = [];

    return new Promise((resolve, reject) => {
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      const pageWidth = doc.page.width - 100;
      let y = 50;

      // ── Helper functions ──
      const addSectionTitle = (text) => {
        doc.fillColor("#166534").fontSize(13).font("Helvetica-Bold");
        doc.text(text, 50, y, { continued: false });
        doc.moveDown(0.3);
        doc
          .fillColor("#d1d5db")
          .rect(50, y + 2, pageWidth, 1)
          .fill();
        y = doc.y + 12;
      };

      const addLabelValue = (label, value) => {
        doc.fillColor("#6b7280").fontSize(9).font("Helvetica");
        doc.text(label, 50, y, { continued: true, width: 120 });
        doc.fillColor("#111827").fontSize(9).font("Helvetica");
        doc.text(`:  ${value || "N/A"}`, { width: pageWidth - 120 });
        y = doc.y + 4;
      };

      const addRecallWarning = (title, message) => {
        const boxHeight = 58;
        checkPageBreak(boxHeight + 12);

        doc
          .roundedRect(50, y, pageWidth, boxHeight, 6)
          .fillAndStroke("#fef2f2", "#dc2626");
        doc.fillColor("#dc2626").fontSize(16).font("Helvetica-Bold");
        doc.text(title, 66, y + 10, { width: pageWidth - 32 });
        doc.fillColor("#7f1d1d").fontSize(9).font("Helvetica-Bold");
        doc.text(message, 66, y + 32, { width: pageWidth - 32 });

        y += boxHeight + 14;
      };

      const checkPageBreak = (needed) => {
        if (y + needed > doc.page.height - 80) {
          doc.addPage();
          y = 50;
          return true;
        }
        return false;
      };

      // ── Header ──
      doc.fillColor("#16a34a").fontSize(22).font("Helvetica-Bold");
      doc.text("CropChain", 50, y);
      doc.fillColor("#6b7280").fontSize(10).font("Helvetica");
      doc.text("Blockchain Crop Traceability Platform", 50, doc.y + 2);
      y = doc.y + 16;

      // Title
      doc.fillColor("#111827").fontSize(18).font("Helvetica-Bold");
      doc.text("Batch Journey Report", 50, y);
      y = doc.y + 6;

      // Horizontal rule
      doc.fillColor("#16a34a").rect(50, y, pageWidth, 2).fill();
      y += 20;

      if (batch.isRecalled) {
        addRecallWarning(
          "RECALLED",
          "CRITICAL FOOD SAFETY ALERT: This batch has been recalled and should not be distributed, sold, or consumed.",
        );
      }

      // ── Batch Summary ──
      addSectionTitle("Batch Summary");

      const fields = [
        ["Batch ID", batch.batchId],
        ["Crop Type", batch.cropType],
        ["Quantity", `${batch.quantity} kg`],
        [
          "Harvest Date",
          batch.harvestDate
            ? new Date(batch.harvestDate).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })
            : "N/A",
        ],
        ["Origin", batch.origin],
        ["Farmer Name", batch.farmerName],
        ["Farmer Address", batch.farmerAddress],
        ["Current Stage", batch.currentStage],
        ["Status", batch.status],
        ["Certifications", batch.certifications],
        ["Description", batch.description],
      ];

      if (checkPageBreak(fields.length * 14)) addSectionTitle("Batch Summary");

      fields.forEach(([label, value]) => addLabelValue(label, value));
      y += 4;

      // ── QR Code ──
      checkPageBreak(140);
      addSectionTitle("QR Code");

      if (batch.qrCode) {
        try {
          const qrData = batch.qrCode;
          const match = qrData.match(/^data:image\/png;base64,(.+)$/);
          if (match) {
            doc.image(Buffer.from(match[1], "base64"), 50, y, {
              width: 100,
              height: 100,
            });
            doc.fillColor("#6b7280").fontSize(8).font("Helvetica");
            doc.text("Scan to verify batch", 50, y + 105);
            y += 120;
          } else {
            y += 4;
          }
        } catch {
          doc.fillColor("#6b7280").fontSize(9).font("Helvetica");
          doc.text("QR code image unavailable", 50, y);
          y += 14;
        }
      } else {
        y += 4;
      }

      // ── Compliance & Blockchain ──
      checkPageBreak(80);
      addSectionTitle("Compliance & Blockchain");

      if (batch.isRecalled) {
        addRecallWarning(
          "RECALLED BATCH WARNING",
          "This compliance report documents a recalled batch. Treat all chain-of-custody records as unsafe or withdrawn.",
        );
      }

      addLabelValue("Blockchain Hash", batch.blockchainHash);
      addLabelValue("Sync Status", batch.syncStatus);
      addLabelValue("Recalled", batch.isRecalled ? "Yes" : "No");
      addLabelValue(
        "Created At",
        batch.createdAt ? new Date(batch.createdAt).toLocaleString() : "N/A",
      );
      addLabelValue(
        "Updated At",
        batch.updatedAt ? new Date(batch.updatedAt).toLocaleString() : "N/A",
      );
      y += 6;

      // ── Supply Chain Timeline ──
      const updates = batch.updates || [];
      checkPageBreak(60);
      addSectionTitle(`Supply Chain Timeline (${updates.length} events)`);

      if (updates.length === 0) {
        doc.fillColor("#6b7280").fontSize(9).font("Helvetica");
        doc.text("No supply chain events recorded.", 50, y);
        y += 14;
      } else {
        updates.forEach((update, index) => {
          const estimatedHeight = 65;
          checkPageBreak(estimatedHeight);

          // Stage badge
          const stageColors = {
            farmer: { bg: "#dcfce7", text: "#166534" },
            mandi: { bg: "#dbeafe", text: "#1e40af" },
            transport: { bg: "#fef3c7", text: "#92400e" },
            retailer: { bg: "#f3e8ff", text: "#6b21a8" },
          };
          const color = stageColors[update.stage] || {
            bg: "#f3f4f6",
            text: "#374151",
          };

          // Background card
          doc
            .fillColor("#f9fafb")
            .roundedRect(50, y, pageWidth, estimatedHeight - 8, 4)
            .fill();

          // Stage circle indicator
          doc.fillColor(color.text).fontSize(10).font("Helvetica-Bold");
          doc
            .circle(70, y + 12, 8)
            .fill(color.bg)
            .fill(color.text);
          doc.text(`${index + 1}`, 66, y + 7, { width: 10, align: "center" });

          // Stage name
          doc.fillColor(color.text).fontSize(10).font("Helvetica-Bold");
          doc.text(
            update.stage.charAt(0).toUpperCase() + update.stage.slice(1),
            88,
            y + 2,
          );

          // Actor & Location
          doc.fillColor("#111827").fontSize(9).font("Helvetica");
          doc.text(update.actor, 88, y + 16);
          doc.fillColor("#6b7280");
          doc.text(update.location, 88, y + 28);

          // Timestamp (right-aligned)
          doc.fillColor("#6b7280").fontSize(8).font("Helvetica");
          const ts = update.timestamp
            ? new Date(update.timestamp).toLocaleString()
            : "";
          doc.text(ts, 50 + pageWidth - 180, y + 2, {
            width: 175,
            align: "right",
          });

          // Notes
          if (update.notes) {
            doc.fillColor("#374151").fontSize(8).font("Helvetica");
            doc.text(update.notes, 88, y + 40, { width: pageWidth - 130 });
          }

          y += estimatedHeight + 2;
        });
      }

      // ── Footer ──
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        doc.fillColor("#9ca3af").fontSize(7).font("Helvetica");
        doc.text(
          `Generated by CropChain — ${new Date().toLocaleString()} — Page ${i + 1} of ${totalPages}`,
          50,
          doc.page.height - 40,
          { width: pageWidth, align: "center" },
        );
      }

      doc.end();
    });
  }
}

module.exports = new PDFService();
