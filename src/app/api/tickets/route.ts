import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWaybillDetail, writebackExceptionStatus } from "@/lib/v2-client";
import { generateDueDate } from "@/lib/approval-engine";

// 工单号生成
function generateTicketNo(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `TICKET-${date}-${rand}`;
}

// GET /api/tickets - 工单列表
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20");
    const status = url.searchParams.get("status") || "";
    const category = url.searchParams.get("category") || "";
    const waybillCode = url.searchParams.get("waybillCode") || "";
    const source = url.searchParams.get("source") || "";

    const where: any = {};
    if (status) where.status = status;
    if (category) where.exceptionCategory = category;
    if (source) where.ticketSource = source;
    if (waybillCode) where.waybillCode = { contains: waybillCode, mode: "insensitive" };

    const [total, tickets] = await Promise.all([
      prisma.exceptionTicket.count({ where }),
      prisma.exceptionTicket.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          submittedBy: { select: { name: true } },
        },
      }),
    ]);

    const formatted = tickets.map((t) => ({
      ...t,
      amount: Number(t.amount),
      aiConfidence: t.aiConfidence ? Number(t.aiConfidence) : null,
      submittedByName: t.submittedBy?.name || "未知",
      submittedBy: undefined,
    }));

    return NextResponse.json({
      success: true,
      data: { data: formatted, total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("[GET /api/tickets]", error);
    return NextResponse.json({ success: false, error: "查询工单失败" }, { status: 500 });
  }
}

// POST /api/tickets - 创建异常工单
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { waybillCode, exceptionType, exceptionCategory, description, severity, amount, submittedById, ticketSource } = body;

    if (!waybillCode || !exceptionType || !submittedById) {
      return NextResponse.json({ success: false, error: "运单号、异常类型和上报人不能为空" }, { status: 400 });
    }

    // 1. 通过 V2 接口真实性校验
    const v2Result = await getWaybillDetail(waybillCode);
    if (v2Result.error) {
      return NextResponse.json({ success: false, error: `V2 校验失败: ${v2Result.error}` }, { status: 400 });
    }

    // 2. 检查同类型未关闭工单
    const existing = await prisma.exceptionTicket.findFirst({
      where: { waybillCode, exceptionType, status: { notIn: ["COMPLETED", "CLOSED"] } },
    });
    if (existing) {
      return NextResponse.json({
        success: false,
        error: `该运单已存在同类型未关闭的异常工单 (${existing.ticketNo})`,
        code: "DUPLICATE",
      }, { status: 409 });
    }

    // 3. 同步/更新运单快照
    if (v2Result.data) {
      await prisma.waybillSnapshot.upsert({
        where: { waybillCode },
        update: {
          storeName: v2Result.data.storeName,
          receiverName: v2Result.data.receiverName,
          receiverPhone: v2Result.data.receiverPhone,
          receiverAddress: v2Result.data.receiverAddress,
          totalQuantity: v2Result.data.totalQuantity,
          skuCount: v2Result.data.totalSkuCount,
          batchId: v2Result.data.batchId,
          remark: v2Result.data.remark,
          dataSource: "V2_API",
          lastSyncAt: new Date(),
        },
        create: {
          waybillCode,
          storeName: v2Result.data.storeName,
          receiverName: v2Result.data.receiverName,
          receiverPhone: v2Result.data.receiverPhone,
          receiverAddress: v2Result.data.receiverAddress,
          totalQuantity: v2Result.data.totalQuantity,
          skuCount: v2Result.data.totalSkuCount,
          batchId: v2Result.data.batchId,
          remark: v2Result.data.remark,
          dataSource: "V2_API",
        },
      });
    }

    // 4. 创建工单
    const ticketNo = generateTicketNo();
    const ticket = await prisma.exceptionTicket.create({
      data: {
        ticketNo,
        waybillCode,
        ticketSource: ticketSource || "MANUAL_REPORT",
        exceptionType,
        exceptionCategory: exceptionCategory || "LOGISTICS",
        severity: severity || "MEDIUM",
        amount: amount || 0,
        description,
        status: "PENDING",
        dueDate: await generateDueDate("PENDING"),
        submittedById,
      },
    });

    // 5. 回写 V2 异常状态
    writebackExceptionStatus(waybillCode, "pending", ticket.id).catch((e) =>
      console.error("[V2 Writeback]", e)
    );

    return NextResponse.json({
      success: true,
      data: { ...ticket, amount: Number(ticket.amount) },
    });
  } catch (error) {
    console.error("[POST /api/tickets]", error);
    return NextResponse.json({ success: false, error: "创建工单失败" }, { status: 500 });
  }
}
