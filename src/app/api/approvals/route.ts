import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidTransition, generateDueDate } from "@/lib/approval-engine";
import type { TicketStatus } from "@/types";

export const dynamic = "force-dynamic";

// POST /api/approvals - 提交审批
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ticketId, approverId, action, opinion, approvalLevel } = body;

    if (!ticketId || !approverId || !action || !approvalLevel) {
      return NextResponse.json({ success: false, error: "缺少必要参数" }, { status: 400 });
    }

    // 幂等性校验
    const idempotencyKey = `${ticketId}:${approverId}:${action}`;
    const existingApproval = await prisma.approvalRecord.findUnique({
      where: { idempotencyKey },
    });
    if (existingApproval) {
      return NextResponse.json({
        success: true,
        data: existingApproval,
        message: "该审批操作已提交（幂等），跳过重复处理",
      });
    }

    // 查询工单（乐观锁：版本号校验）
    const ticket = await prisma.exceptionTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      return NextResponse.json({ success: false, error: "工单不存在" }, { status: 404 });
    }

    // 并发冲突检查
    const ticketVersion = body.version;
    if (ticketVersion && ticket.version !== ticketVersion) {
      return NextResponse.json({
        success: false,
        error: "该工单已被其他人处理，请刷新后重试",
        code: "VERSION_CONFLICT",
      }, { status: 409 });
    }

    // 权限校验：不能审批自己提交的工单
    if (ticket.submittedById === approverId) {
      return NextResponse.json({
        success: false,
        error: "不能审批自己提交的工单",
        code: "SELF_APPROVAL",
      }, { status: 403 });
    }

    // 审批人信息
    const approver = await prisma.user.findUnique({
      where: { id: approverId },
      select: { name: true, disabled: true },
    });
    if (!approver || approver.disabled) {
      return NextResponse.json({ success: false, error: "审批人不可用" }, { status: 403 });
    }

    // 状态流转
    let newStatus: TicketStatus;
    if (action === "APPROVE") {
      newStatus = approvalLevel === 1
        ? (ticket.status === "LEVEL1_APPROVING" ? "EXECUTING" : "EXECUTING")
        : "EXECUTING";
    } else {
      newStatus = "PENDING";
    }

    if (!isValidTransition(ticket.status as TicketStatus, newStatus)) {
      // 如果是一级审批金额超阈值，升级到二级
      if (action === "APPROVE" && approvalLevel === 1 && Number(ticket.amount) >= 5000) {
        newStatus = "LEVEL2_APPROVING";
      } else {
        return NextResponse.json({
          success: false,
          error: `不允许从 ${ticket.status} 转换到 ${newStatus}`,
        }, { status: 400 });
      }
    }

    // 事务：创建审批记录 + 更新工单状态
    const result = await prisma.$transaction(async (tx) => {
      const approval = await tx.approvalRecord.create({
        data: {
          ticketId,
          approverId,
          approverName: approver.name,
          approvalLevel,
          action,
          opinion: opinion || "",
          idempotencyKey,
        },
      });

      const updatedTicket = await tx.exceptionTicket.update({
        where: { id: ticketId },
        data: {
          status: newStatus,
          version: { increment: 1 },
          statusEnteredAt: new Date(),
          dueDate: await generateDueDate(newStatus, tx),
          isOverdue: false,
        },
      });

      // 审批通过 → 执行联动（赔付）
      if (newStatus === "EXECUTING") {
        await handleExecutionLinkage(tx, ticket, approval.id);
      }

      return { approval, ticket: updatedTicket };
    });

    return NextResponse.json({
      success: true,
      data: {
        ...result.approval,
        ticket: { ...result.ticket, amount: Number(result.ticket.amount) },
      },
    });
  } catch (error) {
    console.error("[POST /api/approvals]", error);
    return NextResponse.json({ success: false, error: "审批操作失败" }, { status: 500 });
  }
}

// GET /api/approvals - 获取待审批列表
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId") || "";
    const level = url.searchParams.get("level") || "";

    const where: any = {};

    if (level === "1") where.status = { in: ["PENDING", "LEVEL1_APPROVING"] };
    else if (level === "2") where.status = { in: ["LEVEL2_APPROVING"] };
    else where.status = { in: ["PENDING", "LEVEL1_APPROVING", "LEVEL2_APPROVING"] };

    const tickets = await prisma.exceptionTicket.findMany({
      where,
      orderBy: [{ isOverdue: "desc" }, { createdAt: "asc" }],
      include: {
        submittedBy: { select: { name: true } },
        approvals: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    const formatted = tickets.map((t) => ({
      ...t,
      amount: Number(t.amount),
      submittedByName: t.submittedBy?.name || "未知",
      submittedBy: undefined,
    }));

    return NextResponse.json({ success: true, data: formatted });
  } catch (error) {
    console.error("[GET /api/approvals]", error);
    return NextResponse.json({ success: false, error: "查询审批列表失败" }, { status: 500 });
  }
}

// 执行联动：根据异常类型生成赔付记录和库存变更
async function handleExecutionLinkage(tx: any, ticket: any, approvalRecordId: string) {
  const isLogistics = ticket.exceptionCategory === "LOGISTICS";
  const isQc = ticket.exceptionCategory === "QC";

  // 赔付记录
  const needsCompensation = ["LOST", "DAMAGED", "QC_DAMAGED", "QC_QUANTITY", "QC_SPEC"].includes(ticket.exceptionType);

  if (needsCompensation && Number(ticket.amount) > 0) {
    await tx.compensationRecord.create({
      data: {
        ticketId: ticket.id,
        approvalRecordId: approvalRecordId,
        direction: isLogistics ? "TO_CUSTOMER" : "FROM_SUPPLIER",
        amount: ticket.amount,
        status: "PENDING",
        operatedById: ticket.submittedById,
      },
    });
  }

  // 品控：解锁批次
  if (isQc) {
    await tx.scanRecord.updateMany({
      where: { ticketId: ticket.id },
      data: { batchStatus: "RELEASED" },
    });

    await tx.inventory.updateMany({
      where: { waybillCode: ticket.waybillCode, batchStatus: "QC_HOLD" },
      data: { batchStatus: "RELEASED", lockedQuantity: 0 },
    });
  }
}
