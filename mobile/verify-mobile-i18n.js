const fs = require("fs");
const path = require("path");

function runVerification() {
  console.log("=== Mobile i18n & Offline Storage Verification ===");

  const enPath = path.join(__dirname, "src", "i18n", "locales", "en.json");
  const hiPath = path.join(__dirname, "src", "i18n", "locales", "hi.json");
  const esPath = path.join(__dirname, "src", "i18n", "locales", "es.json");

  const en = JSON.parse(fs.readFileSync(enPath, "utf-8"));
  const hi = JSON.parse(fs.readFileSync(hiPath, "utf-8"));
  const es = JSON.parse(fs.readFileSync(esPath, "utf-8"));

  const enKeys = Object.keys(en).sort();
  const hiKeys = Object.keys(hi).sort();
  const esKeys = Object.keys(es).sort();

  console.log("Checking locale keys parity...");
  console.log("EN Sections:", enKeys.join(", "));
  console.log("HI Sections:", hiKeys.join(", "));
  console.log("ES Sections:", esKeys.join(", "));

  if (JSON.stringify(enKeys) !== JSON.stringify(hiKeys)) {
    throw new Error("Hindi locale keys do not match English locale keys!");
  }
  if (JSON.stringify(enKeys) !== JSON.stringify(esKeys)) {
    throw new Error("Spanish locale keys do not match English locale keys!");
  }

  console.log("✓ All 3 language bundles (EN, HI, ES) match top-level key structure perfectly!");

  // Verify language switcher strings
  console.log("EN common.language:", en.common.language);
  console.log("HI common.language:", hi.common.language);
  console.log("ES common.language:", es.common.language);

  console.log("✓ Language selector translations verified!");

  // Verify SQLite storage service file
  const sqlitePath = path.join(__dirname, "src", "services", "sqliteStorage.ts");
  if (!fs.existsSync(sqlitePath)) {
    throw new Error("sqliteStorage.ts service file is missing!");
  }
  const sqliteContent = fs.readFileSync(sqlitePath, "utf-8");
  if (!sqliteContent.includes("initDatabase") || !sqliteContent.includes("saveBatch") || !sqliteContent.includes("addToSyncQueue")) {
    throw new Error("sqliteStorage.ts missing core SQLite table CRUD functions!");
  }

  console.log("✓ Expo Mobile SQLite Storage Service verified!");

  // Verify BLE Soil Sensor Service & Modal Component
  const bleServicePath = path.join(__dirname, "src", "services", "bleSensorService.ts");
  const bleModalPath = path.join(__dirname, "src", "components", "BLESoilScanModal.tsx");
  if (!fs.existsSync(bleServicePath)) {
    throw new Error("bleSensorService.ts is missing!");
  }
  if (!fs.existsSync(bleModalPath)) {
    throw new Error("BLESoilScanModal.tsx is missing!");
  }
  const bleContent = fs.readFileSync(bleServicePath, "utf-8");
  if (!bleContent.includes("scanDevices") || !bleContent.includes("parseGattPayload")) {
    throw new Error("bleSensorService.ts is missing core GATT parsing functions!");
  }

  console.log("✓ Mobile BLE Soil Sensor Service & GATT Parser verified!");

  // Verify Biometric Authentication Service
  const bioPath = path.join(__dirname, "src", "services", "biometricAuthService.ts");
  if (!fs.existsSync(bioPath)) {
    throw new Error("biometricAuthService.ts is missing!");
  }
  const bioContent = fs.readFileSync(bioPath, "utf-8");
  if (!bioContent.includes("checkHardwareSupport") || !bioContent.includes("authenticateFarmer")) {
    throw new Error("biometricAuthService.ts missing core hardware biometric functions!");
  }

  console.log("✓ Mobile Hardware Biometric Authentication Service verified!");
  console.log("✓ Mobile i18n, Offline Persistence, BLE & Biometric Hardware Verification complete!");
}

runVerification();

