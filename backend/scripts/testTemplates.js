const { compileTemplate } = require("../services/emailService");
const fs = require("fs");

try {
  console.log("Testing batchCreated template...");
  const html = compileTemplate("batchCreated", {
    batchId: "BATCH-123",
    cropType: "Wheat",
    quantity: "500",
    origin: "Farm 1",
    dashboardUrl: "http://localhost:3000/dashboard"
  });
  
  if (html.includes("BATCH-123") && html.includes("Wheat") && html.includes("CropChain")) {
    console.log("✅ Template compiled successfully!");
    console.log("Sample Output snippet:");
    console.log(html.substring(0, 150) + "...");
  } else {
    console.error("❌ Template compiled but missing expected context data.");
  }
} catch (error) {
  console.error("❌ Failed to compile template:", error);
  process.exit(1);
}
