import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { SettingsService } from "./SettingsService";
import { db } from "../db";
import { settings } from "../db/schema";
import { eq } from "drizzle-orm";

describe("SettingsService", () => {
    const TEST_KEY = "TEST_SETTING";
    const EXCLUSION_KEY = "EXCLUDED_DOMAINS";

    beforeAll(async () => {
        // 测试前的清理（可选）
    });

    it("应能保存和获取设置值", async () => {
        const testValue = "hello-world";
        await SettingsService.updateSetting(TEST_KEY, testValue);
        
        const retrieved = await SettingsService.getSetting(TEST_KEY);
        expect(retrieved).toBe(testValue);
    });

    it("应能更新已存在的设置值", async () => {
        await SettingsService.updateSetting(TEST_KEY, "initial");
        await SettingsService.updateSetting(TEST_KEY, "updated");
        
        const retrieved = await SettingsService.getSetting(TEST_KEY);
        expect(retrieved).toBe("updated");
    });

    it("应能正确合并数据库中保存的排除域名", async () => {
        // 保存数据库设置
        await SettingsService.updateSetting(EXCLUSION_KEY, "test-db-excluded.com, another-one.jp");
        
        const allExcluded = await SettingsService.getExcludedDomains();
        
        // 检查是否包含默认域名
        expect(allExcluded).toContain("gmail.com");
        // 检查是否包含数据库中新增的域名
        expect(allExcluded).toContain("test-db-excluded.com");
        expect(allExcluded).toContain("another-one.jp");
    });

    it("应能根据数据库设置进行排除判断", async () => {
        await SettingsService.updateSetting(EXCLUSION_KEY, "ui-configured-competitor.com");
        
        const isExcluded = await SettingsService.isExcluded("ceo@ui-configured-competitor.com");
        expect(isExcluded).toBe(true);

        const isNotExcluded = await SettingsService.isExcluded("partner@awesome-startup.com");
        expect(isNotExcluded).toBe(false);
    });
});
