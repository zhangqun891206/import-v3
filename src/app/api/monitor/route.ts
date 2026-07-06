import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/monitor - 接口监控数据
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20");

    // 汇总统计
    const [totalCalls, successCalls, recentLogs, totalTickets] = await Promise.all([
      prisma.apiSyncLog.count(),
      prisma.apiSyncLog.count({ where: { success: true } }),
      prisma.apiSyncLog.findMany({
        orderBy: { createdAt: "desc" },
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
      prisma.exceptionTicket.count(),
    ]);

    const totalLogs = await prisma.apiSyncLog.count();
    const successRate = totalLogs > 0 ? ((successCalls / totalLogs) * 100).toFixed(1) : "100.0";

    // 最近一次同步时间
    const lastSync = await prisma.waybillSnapshot.findFirst({
      orderBy: { lastSyncAt: "desc" },
      select: { lastSyncAt: true },
    });

    // 各接口调用统计
    const apiStats = await prisma.apiSyncLog.groupBy({
      by: ["apiName"],
      _count: { id: true },
      _avg: { durationMs: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalApiCalls: totalLogs,
          successRate: `${successRate}%`,
          successCalls,
          failedCalls: totalLogs - successCalls,
          totalTickets,
          lastSyncAt: lastSync?.lastSyncAt?.toISOString() || null,
        },
        apiStats: apiStats.map((s) => ({
          apiName: s.apiName,
          callCount: s._count.id,
          avgDurationMs: Math.round(s._avg.durationMs || 0),
        })),
        recentLogs,
        total: totalLogs,
        page,
        pageSize,
        totalPages: Math.ceil(totalLogs / pageSize),
      },
    });
  } catch (error) {
    console.error("[GET /api/monitor]", error);
    return NextResponse.json({ success: false, error: "查询监控数据失败" }, { status: 500 });
  }
}
