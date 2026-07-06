import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/settings - 获取配置
export async function GET() {
  try {
    const configs = await prisma.approvalConfig.findMany();
    return NextResponse.json({ success: true, data: configs });
  } catch (error) {
    console.error("[GET /api/settings]", error);
    return NextResponse.json({ success: false, error: "查询配置失败" }, { status: 500 });
  }
}

// PUT /api/settings - 更新配置
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { configKey, configValue, description } = body;
    if (!configKey) {
      return NextResponse.json({ success: false, error: "缺少配置键" }, { status: 400 });
    }
    const config = await prisma.approvalConfig.upsert({
      where: { configKey },
      update: { configValue, description },
      create: { configKey, configValue, description },
    });
    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    console.error("[PUT /api/settings]", error);
    return NextResponse.json({ success: false, error: "更新配置失败" }, { status: 500 });
  }
}
