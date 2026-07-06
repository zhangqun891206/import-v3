"use client";

import { useEffect, useState } from "react";
import { Activity, CheckCircle, XCircle, Clock, Database } from "lucide-react";

export default function MonitorPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/monitor").then((r) => r.json()).then((d) => {
      if (d.success) setData(d.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-8 text-center text-[var(--color-ink-faint)]">加载中...</div>;
  if (!data) return <div className="p-8 text-center text-[var(--color-ink-faint)]">数据加载失败</div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-ink)] flex items-center gap-3">
          <Activity size={28} className="text-[var(--color-accent)]" />
          接口监控
        </h1>
        <p className="text-sm text-[var(--color-ink-faint)] mt-1">
          监控 V3 ↔ V2 接口调用状态 · 排查跨系统数据不一致问题
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MonitorStat icon={<Activity size={20} />} label="总调用次数" value={data.stats.totalApiCalls} color="accent" />
        <MonitorStat icon={<CheckCircle size={20} />} label="成功率" value={data.stats.successRate} color="success" />
        <MonitorStat icon={<XCircle size={20} />} label="失败次数" value={data.stats.failedCalls} color="danger" />
        <MonitorStat icon={<Database size={20} />} label="最近同步" value={data.stats.lastSyncAt ? new Date(data.stats.lastSyncAt).toLocaleTimeString() : "无"} color="warn" />
      </div>

      {/* API Stats */}
      <div className="card mb-6">
        <h3 className="text-base font-bold text-[var(--color-ink)] mb-4">接口调用统计</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.apiStats?.map((s: any) => (
            <div key={s.apiName} className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg)] border border-[var(--color-line-soft)]">
              <div>
                <span className="text-sm font-medium text-[var(--color-ink)]">{s.apiName}</span>
                <p className="text-xs text-[var(--color-ink-faint)]">平均耗时: {s.avgDurationMs}ms</p>
              </div>
              <span className="font-mono text-lg font-bold text-[var(--color-accent-dark)]">{s.callCount}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Logs */}
      <div className="card !p-0 overflow-hidden">
        <h3 className="text-base font-bold text-[var(--color-ink)] px-6 py-4 border-b border-[var(--color-line)]">最近调用日志</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-ink)] text-white">
                <th className="text-left px-4 py-2">时间</th>
                <th className="text-left px-4 py-2">Request ID</th>
                <th className="text-left px-4 py-2">接口名</th>
                <th className="text-left px-4 py-2">状态码</th>
                <th className="text-left px-4 py-2">耗时</th>
                <th className="text-left px-4 py-2">结果</th>
                <th className="text-left px-4 py-2">错误</th>
              </tr>
            </thead>
            <tbody>
              {data.recentLogs?.map((log: any) => (
                <tr key={log.id} className="border-t border-[var(--color-line-soft)] hover:bg-[var(--color-accent-tint-2)]">
                  <td className="px-4 py-2 text-xs text-[var(--color-ink-faint)]">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2 font-mono text-xs">{log.requestId?.slice(0, 12)}...</td>
                  <td className="px-4 py-2 text-xs">{log.apiName}</td>
                  <td className="px-4 py-2">
                    <span className={`badge ${log.responseStatus >= 200 && log.responseStatus < 300 ? "badge-success" : log.responseStatus === 404 ? "badge-warn" : "badge-danger"}`}>
                      {log.responseStatus || "N/A"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs">{log.durationMs}ms</td>
                  <td className="px-4 py-2">{log.success ? <CheckCircle size={14} className="text-[var(--color-success-line)]" /> : <XCircle size={14} className="text-[var(--color-danger-line)]" />}</td>
                  <td className="px-4 py-2 text-xs text-[var(--color-danger-line)] max-w-[200px] truncate">{log.errorMessage || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MonitorStat({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: string | number; color: string;
}) {
  const borders: Record<string, string> = {
    accent: "border-l-[var(--color-accent)]", success: "border-l-[var(--color-success-line)]",
    danger: "border-l-[var(--color-danger-line)]", warn: "border-l-[var(--color-warn-line)]",
  };
  return (
    <div className={`card !p-5 border-l-4 ${borders[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-[var(--color-ink-faint)]">{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-bold text-[var(--color-ink)]">{value}</div>
    </div>
  );
}
