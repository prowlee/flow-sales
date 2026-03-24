import Anthropic from "@anthropic-ai/sdk";
import { Logger } from "../utils/Logger";

export class ResearchService {
	private static FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
	private static ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

	/**
	 * 使用Firecrawl获取网站内容，并使用Claude进行摘要和分析。
	 * @param url 调查对象的URL
	 * @param options 抓取选项
	 */
	static async researchWebsite(
		url: string,
		options: { mode: "scrape" | "crawl" } = { mode: "scrape" },
	) {
		if (!ResearchService.FIRECRAWL_API_KEY)
			throw new Error("FIRECRAWL_API_KEY is missing");
		if (!ResearchService.ANTHROPIC_API_KEY)
			throw new Error("ANTHROPIC_API_KEY is missing");

		let combinedMarkdown = "";

		if (options.mode === "scrape") {
			// 1. 使用Firecrawl进行抓取
			const scrapeResponse = await fetch(
				"https://api.firecrawl.dev/v1/scrape",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${ResearchService.FIRECRAWL_API_KEY}`,
					},
					body: JSON.stringify({
						url: url,
						formats: ["markdown"],
					}),
				},
			);

			if (!scrapeResponse.ok) {
				throw new Error(`Firecrawl Scrape Error: ${scrapeResponse.statusText}`);
			}

			const scrapeData = (await scrapeResponse.json()) as any;
			combinedMarkdown = scrapeData.data?.markdown || "";
		} else {
			// 2. 使用Firecrawl进行爬取（最多5页）
			Logger.info(`Starting crawl for ${url}...`);
			const crawlResponse = await fetch("https://api.firecrawl.dev/v1/crawl", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${ResearchService.FIRECRAWL_API_KEY}`,
				},
				body: JSON.stringify({
					url: url,
					limit: 5,
					scrapeOptions: {
						formats: ["markdown"],
					},
					// 尝试优先包含公司概要、招聘、新闻等
					allowBackwardLinks: false,
					maxDepth: 2,
				}),
			});

			if (!crawlResponse.ok) {
				throw new Error(`Firecrawl Crawl Error: ${crawlResponse.statusText}`);
			}

			const { id } = (await crawlResponse.json()) as { id: string };

			// 轮询爬取结果
			let status = "running";
			let crawlData: any = null;

			while (status === "running" || status === "scraping") {
				await new Promise((resolve) => setTimeout(resolve, 3000)); // 等待3秒
				const pollResponse = await fetch(
					`https://api.firecrawl.dev/v1/crawl/${id}`,
					{
						headers: {
							Authorization: `Bearer ${ResearchService.FIRECRAWL_API_KEY}`,
						},
					},
				);
				crawlData = await pollResponse.json();
				status = crawlData.status;
				Logger.debug(`Crawl status for ${id}: ${status}`);
			}

			if (status === "completed" && crawlData.data) {
				combinedMarkdown = crawlData.data
					.map(
						(page: any) =>
							`### URL: ${page.metadata?.url || "Unknown"}\n\n${page.markdown || ""}`,
					)
					.join("\n\n---\n\n");
			} else {
				throw new Error(`Crawl failed with status: ${status}`);
			}
		}

		// 2. 使用Claude进行分析
		const anthropic = new Anthropic({
			apiKey: ResearchService.ANTHROPIC_API_KEY,
		});

		// 考虑到20,000 token的限制（Tier 1），将输入截断到一定字符数
		const truncatedMarkdown = combinedMarkdown.substring(0, 6000);

		const response = await anthropic.messages.create({
			model: process.env.ANTHROPIC_MODEL || "claude-3-7-sonnet-latest",
			max_tokens: 1500,
			system: `
        你是一流的销售研究员兼技术顾问。
        请从提供的网站Markdown中，提取用于创建打动决策者（CTO/创始人）的销售信息的重要信息。
        请特别关注“招聘信息（如招聘工程师）”“近期产品发布”“融资”“新闻稿”等能体现“现在应该提案的理由”的信号。

        【重要】回答请仅输出“纯JSON格式”。
        不需要Markdown代码块（ \`\`\`json ... \`\`\` ）或任何解释性文字。
        
        格式：
        {
          "techStack": "使用的技术或语言",
          "businessSummary": "业务内容的简洁摘要",
          "recentNews": "近期重大新闻",
          "technicalPainPoints": "推测的技术课题",
          "hiringIntent": "招聘情况（特别是工程师）",
          "whyNowHook": "『现在』应该提案的具体理由（意图）"
        }
      `,
			messages: [{ role: "user", content: truncatedMarkdown }],
		});

		try {
			// @ts-expect-error
			let content = response.content[0].text;
			// 提取从第一个 { 到最后一个 } 的内容，增强解析的稳健性
			const jsonMatch = content.match(/\{[\s\S]*\}/);
			if (jsonMatch) {
				content = jsonMatch[0];
			}

			const parsed = JSON.parse(content);
			return {
				...parsed,
				fullContent: combinedMarkdown,
			};
		} catch (e) {
			Logger.error("AI Analysis Parse Error or JSON Error:", e);
			Logger.debug(`Raw content was: ${JSON.stringify(response.content[0])}`);
			return {
				techStack: "Unknown",
				businessSummary: "Failed to summarize",
				recentNews: "N/A",
				technicalPainPoints: "N/A",
				hiringIntent: "Unknown",
				whyNowHook: "N/A",
				fullContent: combinedMarkdown,
			};
		}
	}
}
