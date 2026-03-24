export interface ApolloPerson {
	first_name: string;
	last_name: string;
	name: string;
	email?: string;
	title: string;
	organization?: {
		name: string;
		website_url: string;
		primary_domain: string;
	};
}

export class ApolloService {
	private static API_KEY = process.env.APOLLO_API_KEY;
	private static BASE_URL = "https://api.apollo.io/v1";

	/**
	 * 搜索CTO或创始人。
	 * @param titles 职位名称列表
	 */
	static async searchLeads(
		titles: string[] = ["CTO", "Founder"],
		page: number = 1,
	) {
		if (!ApolloService.API_KEY) throw new Error("APOLLO_API_KEY is missing");

		try {
			// POST https://api.apollo.io/api/v1/mixed_people/api_search
			// 建议通过JSON正文发送筛选条件
			const response = await fetch(
				`${ApolloService.BASE_URL}/mixed_people/api_search`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"Cache-Control": "no-cache",
						"X-Api-Key": ApolloService.API_KEY,
					},
					body: JSON.stringify({
						person_titles: titles,
						person_locations: ["Japan"],
						organization_num_employees_ranges: ["1,50"],
						page: page,
						per_page: 10,
					}),
				},
			);

			if (!response.ok) {
				const errorText = await response.text();
				// 如果是免费套餐等没有API访问权限的情况，不抛出错误，返回空数组（以便使用现有潜在客户继续运行）
				if (response.status === 403) {
					console.warn(
						"⚠️ Apollo API Access Denied (403): 免费套餐可能无法使用搜索API。请考虑从仪表盘手动添加，或升级套餐。",
					);
					return { people: [] };
				}
				throw new Error(`Apollo API Error: ${response.status} ${errorText}`);
			}

			return (await response.json()) as { people: ApolloPerson[] };
		} catch (error) {
			console.error("Apollo Search Error:", error);
			return { people: [] }; // 为防止整个工作流停止，出错时返回空数组
		}
	}
}
