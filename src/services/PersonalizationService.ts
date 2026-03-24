import Anthropic from "@anthropic-ai/sdk";

export class PersonalizationService {
	private static ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

	private static SENDER_NAME = process.env.SDR_SENDER_NAME;
	private static SENDER_TITLE = process.env.SDR_SENDER_TITLE;
	private static PRODUCT_NAME = process.env.SDR_PRODUCT_NAME;
	private static PRODUCT_DESCRIPTION = process.env.SDR_PRODUCT_DESCRIPTION;
	private static PRODUCT_RESTRICTIONS = process.env.SDR_PRODUCT_RESTRICTIONS;

	/**
	 * 根据潜在客户信息和调研结果生成个性化邮件。
	 */
	static async generateEmail(
		leadInfo: any,
		researchData: any,
		style: "TECHNICAL" | "BUSINESS" = "TECHNICAL",
	) {
		if (!PersonalizationService.ANTHROPIC_API_KEY)
			throw new Error("ANTHROPIC_API_KEY is missing");

		// 必需配置的验证
		if (!this.SENDER_NAME || !this.PRODUCT_NAME || !this.PRODUCT_DESCRIPTION) {
			throw new Error(
				"SDR configuration is incomplete. Please set SDR_SENDER_NAME, SDR_PRODUCT_NAME, and SDR_PRODUCT_DESCRIPTION in .env",
			);
		}

		const anthropic = new Anthropic({
			apiKey: PersonalizationService.ANTHROPIC_API_KEY,
		});

		const prompt = `
      你是提供${this.PRODUCT_NAME}的${this.SENDER_TITLE || ""}${this.SENDER_NAME}。
      
      【产品/服务信息】
      - 名称: ${this.PRODUCT_NAME}
      - 内容: ${this.PRODUCT_DESCRIPTION}
      - 限制/不适用对象: ${this.PRODUCT_RESTRICTIONS || "无特别限制"}
      
      【重要】你是「${this.PRODUCT_NAME}」的运营者，并非对方公司（${leadInfo.companyName}）的人员。
      请作为外部专家/创业者，向同为创业者的${leadInfo.firstName}先生/女士推荐「${this.PRODUCT_NAME}」。

      【发送风格】
      本次风格: ${style}
      - 选择 TECHNICAL 时: 提及${leadInfo.companyName}的技术栈（${researchData.techStack}）和工程师文化，对开发效率的课题产生共鸣。
      - 选择 BUSINESS 时: 提及${researchData.recentNews}和业务增长（${researchData.businessSummary}），从市场投入速度（TTM）最大化和ROI的角度提出建议。

      【目标信息】
      姓名: ${leadInfo.firstName} ${leadInfo.lastName} 先生/女士
      职位: ${leadInfo.jobTitle}
      公司名称: ${leadInfo.companyName}
      
      【调研结果（优先使用意图数据！）】
      为何现在是合适时机（最重要）: ${researchData.whyNowHook}
      招聘情况: ${researchData.hiringIntent}
      最新动态: ${researchData.recentNews}
      技术栈: ${researchData.techStack}
      业务摘要: ${researchData.businessSummary}
      推测的课题: ${researchData.technicalPainPoints}

      【必须遵守的规则】
      1. 彻底排除AI感:
         - 避免过度使用「～でございます」等生硬表达。使用更柔和的「～です」「～だと思います」。
         - 严禁使用「冒昧打扰」「百忙之中深感抱歉」等客套话。
         - 避免使用「如能为您效劳将不胜荣幸」「烦请考虑」等固定表达。
         - 问候语使用「${leadInfo.firstName}先生/女士，您好（或，初次见面）」等有人情味的形式。
      2. 在开头赢得「信任」:
         - 开篇第一句话必须基于${researchData.whyNowHook}、${researchData.hiringIntent}或${researchData.recentNews}，写出「现在联系你的具体且个性化的理由」。
      3. 形成专家/创业者之间的「对话」:
         - 结合自身经验或专业知识，对${researchData.technicalPainPoints}表示理解和共鸣。
      4. 简单的行动号召:
         - 不要直接要求安排会议，设置「信息交换」「资料发送」等低门槛的下一步。

      【输出格式】
      主题: [让对方忍不住打开的、个性化的15字以内标题]
      正文: [遵循上述规则的正文]

      --
      ${this.SENDER_NAME} | ${this.SENDER_TITLE}
      ${this.PRODUCT_NAME} 负责人
    `;

		const response = await anthropic.messages.create({
			model: process.env.ANTHROPIC_MODEL || "claude-3-7-sonnet-latest",
			max_tokens: 1500,
			messages: [{ role: "user", content: prompt }],
		});

		// @ts-expect-error
		return response.content[0].text;
	}
}
