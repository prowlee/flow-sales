import { type ApolloPerson, ApolloService } from "./ApolloService";
import { InstantlyService } from "./InstantlyService";
import { LeadService } from "./LeadService";
import { PersonalizationService } from "./PersonalizationService";
import { ResearchService } from "./ResearchService";
import { SlackService } from "./SlackService";
import { ExclusionService } from "./ExclusionService";
import { SettingsService } from "./SettingsService";
import { Logger } from "../utils/Logger";

export class AgentService {
	/**
	 * 执行整体工作流。
	 * 1. 从Apollo获取新潜在客户并保存
	 * 2. 按顺序处理未处理的潜在客户（PENDING等）
	 */
	static async runWorkflow() {
		Logger.info("=== Starting FlowSales Workflow ===");

		// 检查每日发送上限
		const dailyLimit = parseInt(process.env.DAILY_SEND_LIMIT || "50", 10);
		const sentToday = await LeadService.getSentCountToday();
		if (sentToday >= dailyLimit) {
			Logger.warn(
				`Daily send limit reached (${sentToday}/${dailyLimit}). Stops.`,
			);
			return;
		}

		// 1. 从Apollo获取新潜在客户并保存
		Logger.info("Fetching new leads from Apollo...");
		try {
			const searchResults = await ApolloService.searchLeads(["CTO", "Founder"]);
			const rawLeads = searchResults.people || [];
			Logger.info(`Found ${rawLeads.length} new potential leads from Apollo.`);

			for (const rawLead of rawLeads) {
				await AgentService.saveRawLead(rawLead);
			}
		} catch (error) {
			Logger.error("Failed to fetch leads from Apollo:", error);
		}

		// 2. 处理未处理的潜在客户
		await AgentService.processPendingLeads();

		// 3. 通知
		const waiting = await LeadService.getLeadsByStatus("WAITING_APPROVAL");
		if (waiting.length > 0) {
			await SlackService.notifyWaitingApproval(waiting.length);
		}

		Logger.info("=== Workflow Completed ===");
	}

	/**
	 * 按顺序对数据库中保存的未处理潜在客户进行研究和发送。
	 */
	static async processPendingLeads() {
		// 优先级: PERSONALIZED (待批准状态以外，发送前) > RESEARCHED > PENDING
		const statuses: (
			| "APPROVED"
			| "PERSONALIZED"
			| "RESEARCHED"
			| "PENDING"
			| "FAILED"
		)[] = ["APPROVED", "PERSONALIZED", "RESEARCHED", "PENDING", "FAILED"];

		for (const status of statuses) {
			const leads = await LeadService.getLeadsByStatus(status as any);
			if (leads.length === 0) continue;

			Logger.info(`Processing ${leads.length} leads with status: ${status}`);

			for (const lead of leads) {
				// 再次检查发送上限
				const sentToday = await LeadService.getSentCountToday();
				const dailyLimit = parseInt(process.env.DAILY_SEND_LIMIT || "50", 10);
				if (sentToday >= dailyLimit) {
					Logger.warn(
						"Daily limit reached during processing. Skipping remaining leads.",
					);
					return;
				}

				try {
					await AgentService.executeLeadWorkflow(lead);
					// 为避免速率限制，每条记录等待5秒
					await new Promise((resolve) => setTimeout(resolve, 5000));
				} catch (error) {
					Logger.error(`Fatal error in lead loop for ${lead.email}:`, error);
				}
			}
		}
	}

	/**
	 * 处理来自Apollo的单个原始潜在客户（用于测试/调试）。
	 */
	static async processSingleLead(rawLead: ApolloPerson) {
		const lead = await AgentService.saveRawLead(rawLead);
		if (lead) {
			await AgentService.executeLeadWorkflow(lead);
			return lead;
		}
		return null;
	}

	/**
	 * 将从Apollo获取的原始数据保存到数据库（包含去重检查）
	 */
	private static async saveRawLead(rawLead: ApolloPerson) {
		const email = rawLead.email;
		if (!email) return null;

		if (await SettingsService.isExcluded(email)) {
			Logger.debug(`Lead skipped (Excluded Domain): ${email}`);
			return null;
		}

		const leadData = {
			email,
			firstName: rawLead.first_name,
			lastName: rawLead.last_name,
			jobTitle: rawLead.title,
			companyName: rawLead.organization?.name || "",
			website: rawLead.organization?.website_url || "",
			status: "PENDING" as const,
		};

		try {
			const lead = await LeadService.upsertLead(leadData);
			if (lead) {
				Logger.info(`New lead saved: ${email}`);
				return lead;
			}
			// 如果是已存在的潜在客户，则重新获取（通过email识别）
			return await LeadService.getLeadByEmail(email);
		} catch (error) {
			Logger.error(`Failed to save lead ${email}:`, error);
			return null;
		}
	}

	/**
	 * 将已保存的单条潜在客户从当前状态推进到最后
	 */
	private static async executeLeadWorkflow(lead: any) {
		try {
			// 2. 研究
			if (lead.status === "PENDING" || lead.status === "FAILED") {
				if (!lead.website) {
					throw new Error("Website URL is missing for research");
				}

				Logger.info(`[Research] ${lead.email} (${lead.website})`);
				const research = await ResearchService.researchWebsite(lead.website, {
					mode: "crawl",
				});

				const [updated] = await LeadService.updateLead(lead.id, {
					techStack: research.techStack,
					researchSummary: research.businessSummary,
					crawledContent: JSON.stringify(research), // 保存全部数据
					status: "RESEARCHED",
				});
				lead = updated;
			}

			// 3. 个性化
			if (lead.status === "RESEARCHED") {
				Logger.info(`[Personalize] ${lead.email}`);
				let researchData;
				try {
					researchData = JSON.parse(lead.crawledContent || "{}");
				} catch (e) {
					// 保持兼容性：如果是旧格式，则构建最小数据集
					researchData = {
						techStack: lead.techStack,
						businessSummary: lead.researchSummary,
						recentNews: "N/A",
						technicalPainPoints: "N/A",
						hiringIntent: "Unknown",
						whyNowHook: "N/A",
					};
				}

				// 根据职位选择风格
				const jobTitle = (lead.jobTitle || "").toUpperCase();
				const style =
					jobTitle.includes("CTO") ||
					jobTitle.includes("ENGINEER") ||
					jobTitle.includes("DEV") ||
					jobTitle.includes("TECH")
						? "TECHNICAL"
						: "BUSINESS";

				Logger.info(`[Personalize] ${lead.email} (Style: ${style})`);
				const email = await PersonalizationService.generateEmail(
					lead,
					researchData,
					style,
				);

				const [updated] = await LeadService.updateLead(lead.id, {
					personalizedEmail: email,
					status: "PERSONALIZED",
				});
				lead = updated;
			}

			// 4. 发送判定
			if (lead.status === "PERSONALIZED") {
				if (process.env.REQUIRE_APPROVAL === "true") {
					Logger.info(`[Wait Approval] ${lead.email}`);
					await LeadService.updateLead(lead.id, { status: "WAITING_APPROVAL" });
					// 发送详细通知到Slack
					await SlackService.notifyNewLeadForApproval(lead);
					return;
				}
				lead.status = "APPROVED"; // 如果不需要批准，则自动视为已批准
			}

			// 5. 发送
			if (lead.status === "APPROVED") {
				Logger.info(`[Send Approved] ${lead.email}`);
				await AgentService.processSending(
					lead.id,
					lead.email,
					lead.firstName || "",
					lead.lastName || "",
					lead.personalizedEmail || "",
				);
			}
		} catch (error: any) {
			Logger.error(`Workflow error for ${lead.email}:`, error.message);
			await LeadService.updateLead(lead.id, {
				status: "FAILED",
				errorLog: error.message,
			});
		}
	}

	/**
	 * 发送处理（包含等待时间）
	 */
	private static async processSending(
		id: string,
		email: string,
		firstName: string,
		lastName: string,
		body: string,
	) {
		// 安全节流 (60秒〜180秒)
		const waitTime = Math.floor(Math.random() * (180 - 60 + 1) + 60);
		Logger.info(`[Send] Waiting ${waitTime}s for ${email}...`);
		await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));

		await InstantlyService.addLeadToCampaign(email, firstName, lastName, body);

		await LeadService.updateLead(id, {
			status: "SENT",
			sentAt: new Date(),
		});
		Logger.info(`[Done] Email sent to ${email}`);
	}
}

