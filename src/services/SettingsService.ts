import { eq } from "drizzle-orm";
import { db } from "../db";
import { settings } from "../db/schema";
import { ExclusionService } from "./ExclusionService";

export class SettingsService {
	/**
	 * 获取设置值。
	 */
	static async getSetting(key: string): Promise<string | null> {
		const result = await db
			.select()
			.from(settings)
			.where(eq(settings.key, key))
			.get();
		return result?.value || null;
	}

	/**
	 * 保存或更新设置值。
	 */
	static async updateSetting(key: string, value: string) {
		const existing = await this.getSetting(key);
		if (existing !== null) {
			await db
				.update(settings)
				.set({ value, updatedAt: new Date() })
				.where(eq(settings.key, key));
		} else {
			await db.insert(settings).values({ key, value });
		}
	}

	/**
	 * 获取排除域名列表（DB + 默认 + 环境变量）。
	 */
	static async getExcludedDomains(): Promise<string[]> {
		const dbValue = await this.getSetting("EXCLUDED_DOMAINS");
		const dbExcluded = dbValue
			? dbValue.split(",").map((d) => d.trim().toLowerCase())
			: [];

		const defaultAndEnv = ExclusionService.getExcludedDomains();
		return Array.from(new Set([...defaultAndEnv, ...dbExcluded]));
	}

	/**
	 * 判断指定邮箱是否为排除对象（考虑数据库设置）。
	 */
	static async isExcluded(email: string): Promise<boolean> {
		if (!email) return true;
		const domain = email.split("@")[1]?.toLowerCase();
		if (!domain) return true;

		const allExcluded = await this.getExcludedDomains();

		return allExcluded.some((excluded) => {
			return domain === excluded || domain.endsWith(`.${excluded}`);
		});
	}
}
