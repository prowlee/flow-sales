import { describe, expect, it, afterEach } from "bun:test";
import { LeadService } from "./LeadService";
import { db } from "../db";
import { leads } from "../db/schema";
import { eq } from "drizzle-orm";

describe("LeadService (集成测试)", () => {
    const TEST_EMAIL = "integration-test@example.com";

    afterEach(async () => {
        // 清理测试数据
        await db.delete(leads).where(eq(leads.email, TEST_EMAIL));
    });

	it("邮箱地址为空时应抛出错误", async () => {
		const invalidLead = {
			firstName: "John",
			lastName: "Doe",
			email: "",
			jobTitle: "CTO",
		} as any;

		expect(LeadService.upsertLead(invalidLead)).rejects.toThrow(
			"Email is required",
		);
	});

    it("应能成功注册新的潜在客户", async () => {
        const leadData = {
            email: TEST_EMAIL,
            firstName: "Test",
            lastName: "User",
            companyName: "Test Corp",
            status: "PENDING" as const,
        };

        const newLead = await LeadService.upsertLead(leadData);
        expect(newLead).not.toBeNull();
        expect(newLead?.email).toBe(TEST_EMAIL);

        // 检查重复注册
        const duplicateResult = await LeadService.upsertLead(leadData);
        expect(duplicateResult).toBeNull();
    });

    it("按状态筛选应能正常工作", async () => {
        await LeadService.upsertLead({
            email: TEST_EMAIL,
            status: "RESEARCHED" as const,
        });

        const researchedLeads = await LeadService.getLeadsByStatus("RESEARCHED");
        expect(researchedLeads.some(l => l.email === TEST_EMAIL)).toBe(true);

        const pendingLeads = await LeadService.getLeadsByStatus("PENDING");
        expect(pendingLeads.some(l => l.email === TEST_EMAIL)).toBe(false);
    });

    it("应能更新潜在客户信息", async () => {
        const lead = await LeadService.upsertLead({
            email: TEST_EMAIL,
            status: "PENDING" as const,
        });

        if (!lead) throw new Error("Setup failed");

        await LeadService.updateLead(lead.id, {
            status: "SENT" as const,
            sentAt: new Date()
        });

        const updated = await db.select().from(leads).where(eq(leads.id, lead.id)).get();
        expect(updated?.status).toBe("SENT");
        expect(updated?.sentAt).not.toBeNull();
    });

    it("应能正确统计今日发送数量", async () => {
        await LeadService.upsertLead({
            email: TEST_EMAIL,
            status: "SENT" as const,
            sentAt: new Date(), // 今日
        });

        const count = await LeadService.getSentCountToday();
        expect(count).toBeGreaterThan(0);
    });

    it("应能正确获取全局统计信息", async () => {
        await LeadService.upsertLead({
            email: TEST_EMAIL,
            status: "FAILED" as const,
        });

        const stats = await LeadService.getGlobalStats();
        expect(stats.TOTAL).toBeGreaterThan(0);
        expect(stats.FAILED).toBeGreaterThan(0);
    });
});

// 模拟依赖db的LeadService演示
describe("LeadService (模拟示例)", () => {
	it("邮箱地址为空时应抛出错误", async () => {
		const invalidLead = {
			firstName: "John",
			lastName: "Doe",
			email: "", // 无效邮箱
			jobTitle: "CTO",
		} as any;

		expect(LeadService.upsertLead(invalidLead)).rejects.toThrow(
			"Email is required",
		);
	});

	// 逻辑测试示例
	it("今日发送的潜在客户数量应返回数值类型", async () => {
		// 实际上可以不实际调用数据库，而替换为模拟对象，
		// 但这里仅确认方法已定义且基本行为正常。
		const count = await LeadService.getSentCountToday();
		expect(typeof count).toBe("number");
	});
});
