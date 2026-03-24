export class ExclusionService {
	private static DEFAULT_EXCLUDED_DOMAINS = [
		"gmail.com",
		"yahoo.co.jp",
		"outlook.com",
		"hotmail.com",
		"icloud.com",
		"me.com",
	];

	/**
	 * 判断指定邮箱地址的域名是否包含在排除列表中。
	 */
	static isExcluded(email: string): boolean {
		if (!email) return true;

		const domain = email.split("@")[1]?.toLowerCase();
		if (!domain) return true;

		const envExcluded = process.env.EXCLUDED_DOMAINS
			? process.env.EXCLUDED_DOMAINS.split(",").map((d) => d.trim().toLowerCase())
			: [];

		const allExcluded = [...this.DEFAULT_EXCLUDED_DOMAINS, ...envExcluded];

		return allExcluded.some((excluded) => {
			// 完全匹配，或子域名匹配（例如：排除 apple.com 时，products.apple.com 也会被排除）
			return domain === excluded || domain.endsWith(`.${excluded}`);
		});
	}

	/**
	 * 返回当前的排除列表。
	 */
	static getExcludedDomains(): string[] {
		const envExcluded = process.env.EXCLUDED_DOMAINS
			? process.env.EXCLUDED_DOMAINS.split(",").map((d) => d.trim().toLowerCase())
			: [];
		return [...this.DEFAULT_EXCLUDED_DOMAINS, ...envExcluded];
	}
}
