import { prisma } from "./prisma";
import type { TicketStatus } from "@/types";

// ============================================================
// 审批引擎：状态流转 + 超时检查 + 幂等性
// ============================================================

/**
 * 状态流转规则
 */
const VALID_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  PENDING: ["LEVEL1_APPROVING", "LEVEL2_APPROVING"], // 超时可直接跳二级
  LEVEL1_APPROVING: ["EXECUTING", "PENDING", "LEVEL2_APPROVING"], // 通过→执行, 拒绝→重提, 金额超阈值→二级
  LEVEL2_APPROVING: ["EXECUTING", "PENDING"], // 通过→执行, 拒绝→重提
  EXECUTING: ["COMPLETED"],
  COMPLETED: ["CLOSED"],
  CLOSED: [],
};

export function isValidTransition(from: TicketStatus, to: TicketStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * 获取审批配置值
 * @param tx 可选的事务客户端，传入后可在事务内安全调用
 */
async function getConfig(key: string, defaultValue: string, tx?: PrismaTx): Promise<string> {
  const client = tx || prisma;
  const config = await client.approvalConfig.findUnique({ where: { configKey: key } });
  return config?.configValue || defaultValue;
}

/**
 * 判断是否需要二级审批（金额超阈值）
 * 阈值从 ApprovalConfig 表读取，完全可配置
 */
export async function requiresLevel2Approval(amount: number): Promise<boolean> {
  const threshold = parseFloat(await getConfig("level2_threshold", "5000"));
  return amount >= threshold;
}

/**
 * 获取审批超时小时数
 * @param tx 可选的事务客户端
 */
export async function getApprovalTimeoutHours(level: 1 | 2, tx?: PrismaTx): Promise<number> {
  const key = level === 1 ? "approval_timeout_hours" : "level2_approval_timeout_hours";
  const defaultValue = level === 1 ? "24" : "48";
  return parseInt(await getConfig(key, defaultValue, tx));
}

/**
 * 获取品控暂扣超时小时数
 */
export async function getQcHoldTimeoutHours(): Promise<number> {
  return parseInt(await getConfig("qc_hold_timeout_hours", "4"));
}

/**
 * 获取最大重新提交次数
 */
export async function getMaxResubmitCount(): Promise<number> {
  return parseInt(await getConfig("max_resubmit_count", "3"));
}

/**
 * 检查超时工单（由定时任务/Cron Job 调用）
 * 返回需要升级的工单列表
 */
export async function checkOverdueTickets(): Promise<{
  escalated: string[];
  rejected: string[];
}> {
  const now = new Date();
  const result = { escalated: [] as string[], rejected: [] as string[] };

  // 查待审批 + 审批中 + 超时
  const overdue = await prisma.exceptionTicket.findMany({
    where: {
      status: { in: ["PENDING", "LEVEL1_APPROVING", "LEVEL2_APPROVING"] },
      dueDate: { lt: now },
      isOverdue: false,
    },
  });

  for (const ticket of overdue) {
    const maxResubmit = await getMaxResubmitCount();

    if (ticket.status === "PENDING") {
      // 待审批超时 → 自动升级到二级审批
      await prisma.exceptionTicket.update({
        where: { id: ticket.id },
        data: {
          status: "LEVEL2_APPROVING",
          isOverdue: true,
          statusEnteredAt: new Date(),
          version: { increment: 1 },
        },
      });
      result.escalated.push(ticket.ticketNo);
    } else if (ticket.status === "LEVEL1_APPROVING") {
      // 一级审批超时 → 自动升级二级
      await prisma.exceptionTicket.update({
        where: { id: ticket.id },
        data: {
          status: "LEVEL2_APPROVING",
          isOverdue: true,
          statusEnteredAt: new Date(),
          version: { increment: 1 },
        },
      });
      result.escalated.push(ticket.ticketNo);
    } else if (ticket.status === "LEVEL2_APPROVING") {
      // 二级审批超时 → 自动驳回
      await prisma.exceptionTicket.update({
        where: { id: ticket.id },
        data: {
          status: "PENDING",
          isOverdue: true,
          timesResubmitted: { increment: 1 },
          statusEnteredAt: new Date(),
          version: { increment: 1 },
        },
      });
      result.rejected.push(ticket.ticketNo);

      // 如果超过最大重提次数，关闭工单
      if (ticket.timesResubmitted + 1 >= maxResubmit) {
        await prisma.exceptionTicket.update({
          where: { id: ticket.id },
          data: { status: "CLOSED" },
        });
      }
    }
  }

  return result;
}

/**
 * 生成超时期限
 * @param tx 可选的事务客户端
 */
export async function generateDueDate(status: TicketStatus, tx?: PrismaTx): Promise<Date | null> {
  if (status === "PENDING" || status === "LEVEL1_APPROVING" || status === "LEVEL2_APPROVING") {
    const hours = status === "LEVEL2_APPROVING"
      ? await getApprovalTimeoutHours(2, tx)
      : await getApprovalTimeoutHours(1, tx);
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }
  return null;
}

/**
 * 审批人禁用兜底：查找可用审批人
 */
export async function findAvailableApprover(
  level: number,
  warehouse?: string
): Promise<{ id: string; name: string } | null> {
  const role = level === 1 ? "level1_approver" : "level2_approver";

  const approvers = await prisma.user.findMany({
    where: {
      role,
      disabled: false,
      ...(warehouse ? { warehouse } : {}),
    },
    select: { id: true, name: true },
  });

  if (approvers.length === 0) {
    // 不限仓库查找
    const globalApprovers = await prisma.user.findMany({
      where: { role, disabled: false },
      select: { id: true, name: true },
      take: 1,
    });
    return globalApprovers[0] || null;
  }

  return approvers[Math.floor(Math.random() * approvers.length)];
}
