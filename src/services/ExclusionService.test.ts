import { describe, expect, it, afterEach } from "bun:test";
import { ExclusionService } from "./ExclusionService";

describe("ExclusionService", () => {
    const originalEnv = process.env.EXCLUDED_DOMAINS;

    afterEach(() => {
        process.env.EXCLUDED_DOMAINS = originalEnv;
    });

    it("能够正确判断默认的排除域名", () => {
        expect(ExclusionService.isExcluded("test@gmail.com")).toBe(true);
        expect(ExclusionService.isExcluded("user@yahoo.co.jp")).toBe(true);
        expect(ExclusionService.isExcluded("someone@hotmail.com")).toBe(true);
    });

    it("能够正确判断非排除目标域名", () => {
        expect(ExclusionService.isExcluded("founder@startup.io")).toBe(false);
        expect(ExclusionService.isExcluded("cto@brand-new-corp.jp")).toBe(false);
    });

    it("能够正确判断通过环境变量添加的额外排除域名", () => {
        process.env.EXCLUDED_DOMAINS = "competitor.com,rival.jp";
        
        expect(ExclusionService.isExcluded("boss@competitor.com")).toBe(true);
        expect(ExclusionService.isExcluded("info@rival.jp")).toBe(true);
        expect(ExclusionService.isExcluded("staff@products.competitor.com")).toBe(true); // 子域名
    });

    it("能够不区分大小写进行判断", () => {
        expect(ExclusionService.isExcluded("TEST@GMAIL.COM")).toBe(true);
    });

    it("对于无效的邮箱地址，应视为排除对象（返回true）", () => {
        expect(ExclusionService.isExcluded("")).toBe(true);
        expect(ExclusionService.isExcluded("invalid-email")).toBe(true);
    });
});
