import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/rules - 品控规则列表
export async function GET() {
  try {
    const rules = await prisma.qcRule.findMany({ orderBy: { priority: "desc" } });
    return NextResponse.json({
      success: true,
      data: rules.map((r) => ({ ...r, thresholdValue: Number(r.thresholdValue), thresholdValue2: r.thresholdValue2 ? Number(r.thresholdValue2) : null })),
    });
  } catch (error) {
    console.error("[GET /api/rules]", error);
    return NextResponse.json({ success: false, error: "查询规则失败" }, { status: 500 });
  }
}

// POST /api/rules - 创建规则
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rule = await prisma.qcRule.create({ data: body });
    return NextResponse.json({
      success: true,
      data: { ...rule, thresholdValue: Number(rule.thresholdValue), thresholdValue2: rule.thresholdValue2 ? Number(rule.thresholdValue2) : null },
    });
  } catch (error) {
    console.error("[POST /api/rules]", error);
    return NextResponse.json({ success: false, error: "创建规则失败" }, { status: 500 });
  }
}

// PUT /api/rules - 更新规则
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ success: false, error: "缺少规则ID" }, { status: 400 });
    const rule = await prisma.qcRule.update({ where: { id }, data });
    return NextResponse.json({
      success: true,
      data: { ...rule, thresholdValue: Number(rule.thresholdValue), thresholdValue2: rule.thresholdValue2 ? Number(rule.thresholdValue2) : null },
    });
  } catch (error) {
    console.error("[PUT /api/rules]", error);
    return NextResponse.json({ success: false, error: "更新规则失败" }, { status: 500 });
  }
}
