"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Filter, ChevronRight, AlertTriangle, Clock } from "lucide-react";

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "待审批", cls: "badge-ghost" },
  LEVEL1_APPROVING: { label: "一级审批中", cls: "badge-accent" },
  LEVEL2_APPROVING: { label: "二级审批中", cls: "badge-warn" },
  EXECUTING: { label: "执行中", cls: "badge-accent" },
  COMPLETED: { label: "已完成", cls: "badge-success" },
  CLOSED: { label: "已关闭", cls: "badge-ghost" },
};

const CATEGORY_LABELS: Record<string, string> = {
  LOGISTICS: "物流异常",
  QC: "品控异常",
};

const SOURCE_LABELS: Record<string, string> = {
  SCAN_TRIGGER: "扫描触发",
  MANUAL_REPORT: "手工上报",
};

export default function TicketsPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchTickets = async (p: number) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), pageSize: "20" });
    if (search) params.set("waybillCode", search);
    if (filterStatus) params.set("status", filterStatus);
    if (filterCategory) params.set("category", filterCategory);

    const res = await fetch(`/api/tickets?${params}`);
    const data = await res.json();
    if (data.success) {
      setTickets(data.data.data);
      setTotal(data.data.total);
    }
    setLoading(false);
  };

  useEffect(() => { fetchTickets(1); }, [filterStatus, filterCategory]);

  const handleSearch = () => { setPage(1); fetchTickets(1); };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-ink)]">工单列表</h1>
          <p className="text-sm text-[var(--color-ink-faint)] mt-1">共 {total} 条工单</p>
        </div>
        <Link href="/tickets/new" className="btn btn-primary">
          异常上报
        </Link>
      </div>

      {/* Filters */}
      <div className="card !p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-faint)]" />
            <input className="input !pl-9" placeholder="搜索运单号..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} />
          </div>
          <select className="input !w-auto" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">全部状态</option>
            <option value="PENDING">待审批</option>
            <option value="LEVEL1_APPROVING">一级审批中</option>
            <option value="LEVEL2_APPROVING">二级审批中</option>
            <option value="EXECUTING">执行中</option>
            <option value="COMPLETED">已完成</option>
            <option value="CLOSED">已关闭</option>
          </select>
          <select className="input !w-auto" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="">全部类别</option>
            <option value="LOGISTICS">物流异常</option>
            <option value="QC">品控异常</option>
          </select>
          <button className="btn btn-secondary" onClick={handleSearch}>筛选</button>
        </div>
      </div>

      {/* Table */}
      <div className="card !p-0 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-[var(--color-ink-faint)]">加载中...</div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center text-[var(--color-ink-faint)]">暂无工单</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-ink)] text-white">
                  <th className="text-left px-4 py-3 font-semibold">工单号</th>
                  <th className="text-left px-4 py-3 font-semibold">运单号</th>
                  <th className="text-left px-4 py-3 font-semibold">类别</th>
                  <th className="text-left px-4 py-3 font-semibold">来源</th>
                  <th className="text-left px-4 py-3 font-semibold">异常类型</th>
                  <th className="text-left px-4 py-3 font-semibold">状态</th>
                  <th className="text-left px-4 py-3 font-semibold">金额</th>
                  <th className="text-left px-4 py-3 font-semibold">上报人</th>
                  <th className="text-left px-4 py-3 font-semibold">时间</th>
                  <th className="text-left px-4 py-3 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => {
                  const statusInfo = STATUS_LABELS[t.status] || { label: t.status, cls: "badge-ghost" };
                  return (
                    <tr key={t.id} className="border-t border-[var(--color-line-soft)] hover:bg-[var(--color-accent-tint-2)] transition-colors">
                      <td className="px-4 py-3 font-mono text-xs">{t.ticketNo}</td>
                      <td className="px-4 py-3 font-medium">{t.waybillCode}</td>
                      <td className="px-4 py-3">
                        <span className={`badge ${t.exceptionCategory === "QC" ? "badge-accent" : "badge-ghost"}`}>
                          {CATEGORY_LABELS[t.exceptionCategory] || t.exceptionCategory}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--color-ink-faint)]">{SOURCE_LABELS[t.ticketSource]}</td>
                      <td className="px-4 py-3 text-xs">{t.exceptionType}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`badge ${statusInfo.cls}`}>{statusInfo.label}</span>
                          {t.isOverdue && <Clock size={14} className="text-[var(--color-danger-line)]" />}
                        </div>
                      </td>
                      <td className="px-4 py-3">{t.amount > 0 ? `¥${t.amount}` : "-"}</td>
                      <td className="px-4 py-3 text-xs text-[var(--color-ink-faint)]">{t.submittedByName}</td>
                      <td className="px-4 py-3 text-xs text-[var(--color-ink-faint)]">{new Date(t.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <Link href={`/tickets/${t.id}`} className="text-[var(--color-accent-dark)] hover:underline text-xs font-semibold">
                          详情 →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button className="btn btn-ghost" disabled={page <= 1} onClick={() => { setPage(page - 1); fetchTickets(page - 1); }}>上一页</button>
          <span className="text-sm text-[var(--color-ink-faint)]">第 {page} 页 / 共 {Math.ceil(total / 20)} 页</span>
          <button className="btn btn-ghost" disabled={page >= Math.ceil(total / 20)} onClick={() => { setPage(page + 1); fetchTickets(page + 1); }}>下一页</button>
        </div>
      )}
    </div>
  );
}
