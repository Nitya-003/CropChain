import en from "../i18n/locales/en.json";
import hi from "../i18n/locales/hi.json";
import es from "../i18n/locales/es.json";
import { offlineStorage } from "../services/offlineStorage";

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () => {
  let store: Record<string, string> = {};
  return {
    setItem: jest.fn(async (key: string, val: string) => {
      store[key] = val;
    }),
    getItem: jest.fn(async (key: string) => store[key] || null),
    multiRemove: jest.fn(async (keys: string[]) => {
      keys.forEach((k) => delete store[k]);
    }),
  };
});

describe("Mobile i18n & Offline Storage Test Suite", () => {
  describe("i18n Localization Bundles", () => {
    it("should contain matching top-level translation sections in English, Hindi, and Spanish", () => {
      const enKeys = Object.keys(en).sort();
      const hiKeys = Object.keys(hi).sort();
      const esKeys = Object.keys(es).sort();

      expect(enKeys).toEqual(hiKeys);
      expect(enKeys).toEqual(esKeys);
    });

    it("should contain language selector keys in all bundles", () => {
      expect(en.common.language).toBe("Language");
      expect(hi.common.language).toBe("भाषा");
      expect(es.common.language).toBe("Idioma");
    });
  });

  describe("Offline Storage & Scan History", () => {
    it("should save and retrieve offline scan history", async () => {
      await offlineStorage.saveScanHistory("CROP-TEST-001");
      await offlineStorage.saveScanHistory("CROP-TEST-002");

      const history = await offlineStorage.getScanHistory();
      expect(history).toContain("CROP-TEST-001");
      expect(history).toContain("CROP-TEST-002");
    });

    it("should queue offline sync items with priority sorting", async () => {
      await offlineStorage.addToQueue({
        type: "update_stage",
        data: { id: "B1", stage: "mandi" },
        priority: "normal",
      });

      await offlineStorage.addToQueue({
        type: "create_batch",
        data: { cropType: "Wheat" },
        priority: "high",
      });

      const queue = await offlineStorage.getQueue();
      expect(queue.length).toBe(2);
      expect(queue[0].priority).toBe("high");
      expect(queue[1].priority).toBe("normal");
    });
  });
});
