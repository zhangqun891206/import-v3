import { NextRequest, NextResponse } from "next/server";
import { checkOverdueTickets } from "@/lib/approval-engine";

// GET /api/cron/check-overdue - 定时检查超时工单
// 部署后设置 Vercel Cron Job 每小时调用一次
export async function GET(req: NextRequest) {
  try {
    // 简单的 Secret 鉴权
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET || "v3-cron-secret-2024";

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const result = await checkOverdueTickets();

    return NextResponse.json({
      success: true,
      data: {
        escalated: result.escalated,
        rejected: result.rejected,
        escalatedCount: result.escalated.length,
        rejectedCount: result.rejected.length,
        checkedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[Cron check-overdue]", error);
    return NextResponse.json({ success: false, error: "超时检查失败" }, { status: 500 });
  }
}
