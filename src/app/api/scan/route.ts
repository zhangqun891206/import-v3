import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySkuBelongsToOrder, getWaybillDetail } from "@/lib/v2-client";
import { runQcCheck } from "@/lib/qc-engine";

// POST /api/scan - 扫描录入 + 品控检测
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { waybillCode, skuCode, batchNo, operatorId, scannedQuantity, expectedQuantity, damageLevel } = body;

    if (!waybillCode || !skuCode || !operatorId) {
      return NextResponse.json({ success: false, error: "运单号、SKU编码和操作人不能为空" }, { status: 400 });
    }

    // 1. V2 接口校验：SKU 归属
    const skuResult = await verifySkuBelongsToOrder(waybillCode, skuCode);
    if (skuResult.error) {
      return NextResponse.json({
        success: false,
        error: `SKU 校验失败: ${skuResult.error}`,
      }, { status: 400 });
    }

    // 2. 幂等性检查：该 SKU 批次已有未关闭品控工单
    const existingTicket = await prisma.exceptionTicket.findFirst({
      where: {
        waybillCode,
        exceptionCategory: "QC",
        status: { notIn: ["COMPLETED", "CLOSED"] },
        scanRecords: { some: { skuCode, batchNo: batchNo || null } },
      },
      select: { id: true, ticketNo: true, status: true },
    });

    if (existingTicket) {
      // 追加扫描记录（不创建新工单）
      const scanRecord = await prisma.scanRecord.create({
        data: {
          waybillCode,
          skuCode,
          batchNo: batchNo || null,
          operatorId,
          qcResult: "FAIL",
          qcDescription: "重复扫描：该批次已存在未关闭品控工单",
          batchStatus: "QC_HOLD",
          ticketId: existingTicket.id,
        },
      });

      return NextResponse.json({
        success: true,
        data: scanRecord,
        message: `该批次已存在未关闭品控工单 (${existingTicket.ticketNo})，已追加扫描记录`,
        duplicateTicket: existingTicket,
      });
    }

    // 3. 执行品控规则引擎检测
    const qcResult = await runQcCheck({
      waybillCode,
      skuCode,
      batchNo,
      scannedQuantity,
      expectedQuantity,
      damageLevel,
    });

    // 4. 创建扫描记录
    const scanRecord = await prisma.scanRecord.create({
      data: {
        waybillCode,
        skuCode,
        batchNo: batchNo || null,
        operatorId,
        qcResult: qcResult.passed ? "PASS" : "FAIL",
        qcRuleMatched: qcResult.passed ? null : qcResult.failedRules[0]?.ruleId,
        qcRuleName: qcResult.passed ? null : qcResult.failedRules[0]?.ruleName,
        qcDescription: qcResult.passed ? "品控通过" : qcResult.failedRules.map((r) => r.description).join("; "),
        qcSeverity: qcResult.passed ? null : qcResult.failedRules[0]?.severity,
        batchStatus: qcResult.passed ? "SCANNED" : "QC_HOLD",
      },
    });

    // 5. 品控异常：自动创建工单 + 批次锁定
    if (!qcResult.passed) {
      const ticketNo = `TICKET-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

      const ticket = await prisma.exceptionTicket.create({
        data: {
          ticketNo,
          waybillCode,
          ticketSource: "SCAN_TRIGGER",
          exceptionType: qcResult.failedRules[0]?.ruleType === "QUANTITY_DIFF" ? "QC_QUANTITY"
            : qcResult.failedRules[0]?.ruleType === "APPEARANCE_DAMAGE" ? "QC_DAMAGED"
            : "QC_BATCH",
          exceptionCategory: "QC",
          severity: qcResult.failedRules[0]?.severity || "MEDIUM",
          amount: 0,
          description: qcResult.failedRules.map((r) => r.description).join("; "),
          status: "LEVEL2_APPROVING", // 品控异常直接进入二级审批
          dueDate: new Date(Date.now() + 4 * 60 * 60 * 1000), // 品控4小时超时
          submittedById: operatorId,
        },
      });

      // 关联扫描记录到工单
      await prisma.scanRecord.update({
        where: { id: scanRecord.id },
        data: { ticketId: ticket.id, batchStatus: "QC_HOLD" },
      });

      // 批次锁定库存
      const v2Data = await getWaybillDetail(waybillCode);
      if (v2Data.data) {
        await prisma.inventory.upsert({
          where: {
            waybillCode_skuCode_batchNo: {
              waybillCode,
              skuCode,
              batchNo: batchNo || "DEFAULT",
            },
          },
          update: { batchStatus: "QC_HOLD", lockedQuantity: scannedQuantity || 0 },
          create: {
            waybillCode,
            skuCode,
            skuName: skuResult.data?.skuName || "",
            quantity: scannedQuantity || 0,
            lockedQuantity: scannedQuantity || 0,
            batchStatus: "QC_HOLD",
            batchNo: batchNo || "DEFAULT",
          },
        });
      }

      return NextResponse.json({
        success: true,
        data: { scanRecord, ticket },
        qcResult,
      });
    }

    return NextResponse.json({
      success: true,
      data: scanRecord,
      qcResult,
    });
  } catch (error) {
    console.error("[POST /api/scan]", error);
    return NextResponse.json({ success: false, error: "扫描操作失败" }, { status: 500 });
  }
}

// GET /api/scan - 扫描记录列表
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20");

    const [total, records] = await Promise.all([
      prisma.scanRecord.count(),
      prisma.scanRecord.findMany({
        orderBy: { scannedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { operator: { select: { name: true } } },
      }),
    ]);

    const formatted = records.map((r) => ({
      ...r,
      aiConfidence: r.aiConfidence ? Number(r.aiConfidence) : null,
      operatorName: r.operator?.name || "未知",
      operator: undefined,
    }));

    return NextResponse.json({
      success: true,
      data: { data: formatted, total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("[GET /api/scan]", error);
    return NextResponse.json({ success: false, error: "查询扫描记录失败" }, { status: 500 });
  }
}
