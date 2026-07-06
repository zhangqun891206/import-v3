"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, AlertTriangle, Clock, UserX, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "待审批", LEVEL1_APPROVING: "一级审批中", LEVEL2_APPROVING: "二级审批中",
};

export default function ApprovalPage() {
  const { addToast } = useToast();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalTicket, setModalTicket] = useState<any>(null);
  const [opinion, setOpinion] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchTickets = async () => {
    setLoading(true);
    const res = await fetch("/api/approvals");
    const data = await res.json();
    if (data.success) setTickets(data.data);
    setLoading(false);
  };

  useEffect(() => { fetchTickets(); }, []);

  const handleApproval = async (action: "APPROVE" | "REJECT") => {
    if (!modalTicket) return;
    setSubmitting(true);
    try {
      const level = modalTicket.status === "LEVEL2_APPROVING" ? 2 : 1;
      const res = await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: modalTicket.id,
          approverId: "demo-approver-001",
          action,
          opinion,
          approvalLevel: level,
          version: modalTicket.version,
        }),
      });
      const data = await res.json();
      if (data.success) {
        addToast("success", action === "APPROVE" ? "审批通过" : "已拒绝，工单退回");
        setModalTicket(null);
        setOpinion("");
        fetchTickets();
      } else {
        addToast("error", data.error || "操作失败");
      }
    } catch {
      addToast("error", "网络错误");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-ink)] flex items-center gap-3">
          <CheckCircle size={28} className="text-[var(--color-accent)]" />
          审批中心
        </h1>
        <p className="text-sm text-[var(--color-ink-faint)] mt-1">
          处理待审批工单 · 支持一级/二级分级审批 · 有并发冲突保护
        </p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-[var(--color-ink-faint)]">加载中...</div>
      ) : tickets.length === 0 ? (
        <div className="card p-12 text-center text-[var(--color-ink-faint)]">
          <CheckCircle size={40} className="mx-auto mb-3 text-[var(--color-accent)]" />
          <p className="text-lg font-semibold text-[var(--color-ink)] mb-1">暂无待审批工单</p>
          <p>所有工单已处理完毕</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tickets.map((t) => (
            <div key={t.id} className={`card ${t.isOverdue ? "!border-[var(--color-danger-line)]" : ""}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono font-semibold text-sm">{t.ticketNo}</span>
                    <span className={`badge ${t.status === "LEVEL2_APPROVING" ? "badge-warn" : "badge-accent"}`}>
                      {STATUS_LABELS[t.status]}
                    </span>
                    {t.isOverdue && <span className="badge badge-danger !text-xs">超时</span>}
                    {t.ticketSource === "SCAN_TRIGGER" && <span className="badge badge-accent">扫描触发</span>}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <InfoRow label="运单号" value={t.waybillCode} />
                    <InfoRow label="异常类型" value={t.exceptionType} />
                    <InfoRow label="严重度" value={t.severity} />
                    <InfoRow label="金额" value={t.amount > 0 ? `¥${t.amount}` : "-"} />
                  </div>
                  <p className="text-sm text-[var(--color-ink-soft)] mt-2 line-clamp-2">{t.description || "无描述"}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-[var(--color-ink-faint)]">
                    <span>上报人: {t.submittedByName}</span>
                    <span>创建: {new Date(t.createdAt).toLocaleString()}</span>
                    <span>版本: v{t.version}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    className="btn btn-primary"
                    onClick={() => { setModalTicket(t); setOpinion(""); }}
                  >
                    <CheckCircle size={16} /> 审批
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Approval Modal */}
      <Modal open={!!modalTicket} onClose={() => setModalTicket(null)} title={`审批工单: ${modalTicket?.ticketNo}`}>
        {modalTicket && (
          <div>
            <div className="mb-4 p-3 rounded-lg bg-[var(--color-bg)] text-sm">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={16} className="text-[var(--color-warn-line)]" />
                <span className="font-medium">{modalTicket.exceptionType}</span>
              </div>
              <p className="text-[var(--color-ink-soft)]">{modalTicket.description || "无描述"}</p>
              <p className="text-xs text-[var(--color-ink-faint)] mt-1">金额: ¥{modalTicket.amount} | 上报人: {modalTicket.submittedByName}</p>
            </div>
            <div className="mb-4">
              <label className="text-sm font-medium text-[var(--color-ink)] mb-1 block">审批意见</label>
              <textarea className="input" rows={3} placeholder="输入审批意见..." value={opinion} onChange={(e) => setOpinion(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary flex-1 justify-center py-2.5" onClick={() => handleApproval("APPROVE")} disabled={submitting}>
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                通过
              </button>
              <button className="btn btn-danger flex-1 justify-center py-2.5" onClick={() => handleApproval("REJECT")} disabled={submitting}>
                <XCircle size={16} /> 拒绝
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <span className="text-xs text-[var(--color-ink-faint)] block">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
