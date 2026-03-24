import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { leads } from "../db/schema";

export class LeadService {
	/**
	 * 获取或创建潜在客户，防止重复。
	 * @param leadData 要注册的潜在客户信息
	 * @returns 已注册的潜在客户，若已存在则返回null
	 */
	static async upsertLead(leadData: typeof leads.$inferInsert) {
		if (!leadData.email) throw new Error("Email is required");

		const existing = await db
			.select()
			.from(leads)
			.where(eq(leads.email, leadData.email))
			.get();

		if (existing) {
			return null;
		}

		const [newLead] = await db.insert(leads).values(leadData).returning();
		return newLead;
	}

	/**
	 * 根据邮箱地址获取一条潜在客户记录。
	 */
	static async getLeadByEmail(email: string) {
		return await db
			.select()
			.from(leads)
			.where(eq(leads.email, email))
			.get();
	}

	/**
	 * 获取指定状态的潜在客户列表。
	 */
	static async getLeadsByStatus(
		status:
			| "PENDING"
			| "RESEARCHED"
			| "PERSONALIZED"
			| "WAITING_APPROVAL"
			| "APPROVED"
			| "SENT"
			| "FAILED",
	) {
		return await db
			.select()
			.from(leads)
			.where(sql`${leads.status} = ${status} AND ${leads.unsubscribed} = 0`)
			.all();
	}

	/**
	 * 更新潜在客户的状态和信息。
	 * @param id 潜在客户ID
	 * @param updateData 更新内容
	 */
	static async updateLead(
		id: string,
		updateData: Partial<typeof leads.$inferInsert>,
	) {
		return await db
			.update(leads)
			.set({ ...updateData, updatedAt: new Date() })
			.where(eq(leads.id, id))
			.returning();
	}

	/**
	 * 获取今日已发送的潜在客户数量。
	 */
	static async getSentCountToday() {
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const result = await db
			.select({ count: sql<number>`count(*)` })
			.from(leads)
			.where(
				sql`${leads.status} = 'SENT' AND ${leads.sentAt} >= ${today.getTime() / 1000}`,
			)
			.get();

		return result?.count || 0;
	}

	/**
	 * 获取整体统计数据。
	 */
	static async getGlobalStats() {
		const result = await db
			.select({
				status: leads.status,
				count: sql<number>`count(*)`,
			})
			.from(leads)
			.groupBy(leads.status)
			.all();

		const stats = {
			TOTAL: 0,
			PENDING: 0,
			RESEARCHED: 0,
			PERSONALIZED: 0,
			WAITING_APPROVAL: 0,
			APPROVED: 0,
			SENT: 0,
			FAILED: 0,
		};

		for (const row of result) {
			if (row.status && row.status in stats) {
				(stats as any)[row.status] = row.count;
				stats.TOTAL += row.count;
			}
		}

		return stats;
	}
}
