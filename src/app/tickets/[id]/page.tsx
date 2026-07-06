"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock, AlertTriangle, CheckCircle, XCircle, RotateCcw, Shield } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "待审批", cls: "badge-ghost" },
  LEVEL1_APPROVING: { label: "一级审批中", cls: "badge-accent" },
  LEVEL2_APPROVING: { label: "二级审批中", cls: "badge-warn" },
  EXECUTING: { label: "执行中", cls: "badge-accent" },
  COMPLETED: { label: "已完成", cls: "badge-success" },
  CLOSED: { label: "已关闭", cls: "badge-ghost" },
};

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { addToast } = useToast();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/tickets/${id}`).then((r) => r.json()).then((d) => {
      if (d.success) setTicket(d.data);
      setLoading(false);
    });
  }, [id]);

  const handleResubmit = async () => {
    const res = await fetch(`/api/tickets/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PENDING" }),
    });
    const data = await res.json();
    if (data.success) {
      addToast("success", "工单已重新提交");
      setTicket((prev: any) => ({ ...prev, ...data.data }));
    } else {
      addToast("error", data.error || "操作失败");
    }
  };

  if (loading) return <div className="p-8 text-center text-[var(--color-ink-faint)]">加载中...</div>;
  if (!ticket) return <div className="p-8 text-center text-[var(--color-ink-faint)]">工单不存在</div>;

  const statusInfo = STATUS_LABELS[ticket.status] || { label: ticket.status, cls: "badge-ghost" };

  return (
    <div>
      <Link href="/tickets" className="inline-flex items-center gap-1 text-sm text-[var(--color-ink-faint)] hover:text-[var(--color-accent-dark)] mb-4">
        <ArrowLeft size={16} /> 返回工单列表
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-ink)] flex items-center gap-3">
            {ticket.ticketNo}
            <span className={`badge ${statusInfo.cls}`}>{statusInfo.label}</span>
            {ticket.isOverdue && <Clock size={18} className="text-[var(--color-danger-line)]" />}
            {ticket.qcFastRelease && <Shield size={18} className="text-[var(--color-accent)]" />}
          </h1>
          <p className="text-sm text-[var(--color-ink-faint)] mt-1">
            来源: {ticket.ticketSource === "SCAN_TRIGGER" ? "扫描自动触发" : "手工上报"} · 类别: {ticket.exceptionCategory === "QC" ? "品控异常" : "物流异常"}
          </p>
        </div>
        {(ticket.status === "PENDING" || ticket.status === "EXECUTING") && (
          <div className="flex gap-2">
            {ticket.status === "PENDING" && ticket.timesResubmitted < ticket.maxResubmit && (
              <button className="btn btn-secondary" onClick={handleResubmit}>
                <RotateCcw size={16} /> 重新提交 ({ticket.timesResubmitted}/{ticket.maxResubmit})
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ticket Info */}
          <div className="card">
            <h3 className="text-base font-bold text-[var(--color-ink)] mb-4">工单信息</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <InfoRow label="运单号" value={ticket.waybillCode} />
              <InfoRow label="异常类型" value={ticket.exceptionType} />
              <InfoRow label="严重度" value={ticket.severity} />
              <InfoRow label="涉及金额" value={ticket.amount > 0 ? `¥${ticket.amount}` : "-"} />
              <InfoRow label="上报人" value={ticket.submittedBy?.name || "未知"} />
              <InfoRow label="创建时间" value={new Date(ticket.createdAt).toLocaleString()} />
              <InfoRow label="重提次数" value={`${ticket.timesResubmitted}/${ticket.maxResubmit}`} />
              {ticket.dueDate && (
                <InfoRow label="超时期限" value={new Date(ticket.dueDate).toLocaleString()} />
              )}
            </div>
            {ticket.description && (
              <div className="mt-4 pt-4 border-t border-[var(--color-line)]">
                <p className="text-sm font-medium text-[var(--color-ink)] mb-1">异常描述</p>
                <p className="text-sm text-[var(--color-ink-soft)]">{ticket.description}</p>
              </div>
            )}
          </div>

          {/* Approval History */}
          <div className="card">
            <h3 className="text-base font-bold text-[var(--color-ink)] mb-4">审批记录（审计日志）</h3>
            {ticket.approvals?.length === 0 ? (
              <p className="text-sm text-[var(--color-ink-faint)]">暂无审批记录</p>
            ) : (
              <div className="space-y-3">
                {ticket.approvals?.map((a: any) => (
                  <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg bg-[var(--color-bg)] border border-[var(--color-line-soft)]">
                    <div className={`mt-0.5 ${a.action === "APPROVE" ? "text-[var(--color-success-line)]" : "text-[var(--color-danger-line)]"}`}>
                      {a.action === "APPROVE" ? <CheckCircle size={18} /> : <XCircle size={18} />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{a.approverName}</span>
                        <span className="badge badge-ghost">{a.approvalLevel}级审批</span>
                        <span className="text-xs text-[var(--color-ink-faint)]">{new Date(a.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-[var(--color-ink-soft)] mt-1">
                        {a.action === "APPROVE" ? "✓ 通过" : "✗ 拒绝"}
                        {a.opinion && ` — ${a.opinion}`}
                      </p>
                      {a.aiOpinion && (
                        <p className="text-xs text-[var(--color-accent-dark)] mt-1 bg-[var(--color-accent-tint)] p-1.5 rounded">
                          🤖 AI 建议: {a.aiOpinion}（需人工确认）
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Waybill Snapshot */}
          {ticket.waybillSnapshot && (
            <div className="card">
              <h3 className="text-base font-bold text-[var(--color-ink)] mb-3">运单信息</h3>
              <div className="mb-2">
                <span className={`data-source-tag ${ticket.waybillSnapshot.dataSource === "V2_API" ? "realtime" : "cached"}`}>
                  {ticket.waybillSnapshot.dataSource === "V2_API" ? "实时获取自 V2" : `缓存 · 同步于 ${new Date(ticket.waybillSnapshot.lastSyncAt).toLocaleString()}`}
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <InfoRow label="收件人" value={ticket.waybillSnapshot.receiverName || "-"} />
                <InfoRow label="电话" value={ticket.waybillSnapshot.receiverPhone || "-"} />
                <InfoRow label="地址" value={ticket.waybillSnapshot.receiverAddress || "-"} />
                <InfoRow label="SKU 总数" value={ticket.waybillSnapshot.skuCount} />
                <InfoRow label="总数量" value={ticket.waybillSnapshot.totalQuantity} />
              </div>
            </div>
          )}

          {/* Compensation */}
          {ticket.compensation && (
            <div className="card">
              <h3 className="text-base font-bold text-[var(--color-ink)] mb-3">赔付记录</h3>
              <div className="space-y-2 text-sm">
                <InfoRow label="赔付方向" value={ticket.compensation.direction === "TO_CUSTOMER" ? "赔付客户" : "向供应商追偿"} />
                <InfoRow label="金额" value={`¥${ticket.compensation.amount}`} />
                <InfoRow label="状态" value={ticket.compensation.status} />
                {ticket.compensation.referenceNo && <InfoRow label="对账参考号" value={ticket.compensation.referenceNo} />}
              </div>
              <p className="text-xs text-[var(--color-ink-faint)] mt-3 pt-3 border-t border-[var(--color-line)]">
                由审批记录触发 · 审批人操作时间: {new Date(ticket.compensation.operatedAt).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <span className="text-xs text-[var(--color-ink-faint)] block">{label}</span>
      <span className="text-sm font-medium text-[var(--color-ink)]">{value}</span>
    </div>
  );
}
