import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writebackExceptionStatus } from "@/lib/v2-client";

// GET /api/tickets/[id] - 工单详情
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ticket = await prisma.exceptionTicket.findUnique({
      where: { id },
      include: {
        submittedBy: { select: { id: true, name: true, role: true } },
        approvals: {
          orderBy: { createdAt: "asc" },
          include: { approver: { select: { id: true, name: true } } },
        },
        compensation: true,
        scanRecords: {
          orderBy: { scannedAt: "desc" },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json({ success: false, error: "工单不存在" }, { status: 404 });
    }

    // 获取运单快照数据
    const snapshot = await prisma.waybillSnapshot.findUnique({
      where: { waybillCode: ticket.waybillCode },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...ticket,
        amount: Number(ticket.amount),
        aiConfidence: ticket.aiConfidence ? Number(ticket.aiConfidence) : null,
        compensation: ticket.compensation ? {
          ...ticket.compensation,
          amount: Number(ticket.compensation.amount),
          priceDiffAmount: ticket.compensation.priceDiffAmount ? Number(ticket.compensation.priceDiffAmount) : null,
        } : null,
        waybillSnapshot: snapshot,
      },
    });
  } catch (error) {
    console.error("[GET /api/tickets/[id]]", error);
    return NextResponse.json({ success: false, error: "查询工单失败" }, { status: 500 });
  }
}

// PUT /api/tickets/[id] - 更新工单（重新提交等）
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { status, description, severity, amount } = body;

    const ticket = await prisma.exceptionTicket.findUnique({ where: { id } });
    if (!ticket) {
      return NextResponse.json({ success: false, error: "工单不存在" }, { status: 404 });
    }

    const updateData: any = { version: { increment: 1 } };
    if (status) updateData.status = status;
    if (description) updateData.description = description;
    if (severity) updateData.severity = severity;
    if (amount !== undefined) updateData.amount = amount;

    // 重新提交逻辑
    if (status === "PENDING" && ticket.status !== "PENDING") {
      updateData.timesResubmitted = { increment: 1 };
      updateData.statusEnteredAt = new Date();
      updateData.dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      updateData.isOverdue = false;
    }

    // 执行完成
    if (status === "COMPLETED") {
      // 回写 V2：异常已处理
      writebackExceptionStatus(ticket.waybillCode, "resolved", ticket.id).catch((e) =>
        console.error("[V2 Writeback]", e)
      );
    }

    const updated = await prisma.exceptionTicket.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: { ...updated, amount: Number(updated.amount) },
    });
  } catch (error) {
    console.error("[PUT /api/tickets/[id]]", error);
    return NextResponse.json({ success: false, error: "更新工单失败" }, { status: 500 });
  }
}
