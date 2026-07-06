"use client";

import { useState } from "react";
import { ScanLine, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

export default function ScanPage() {
  const { addToast } = useToast();
  const [form, setForm] = useState({ waybillCode: "", skuCode: "", batchNo: "", scannedQuantity: "", expectedQuantity: "", damageLevel: "" });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleScan = async () => {
    if (!form.waybillCode || !form.skuCode) {
      addToast("warning", "请输入外部编码和SKU编码");
      return;
    }
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          waybillCode: form.waybillCode,
          skuCode: form.skuCode,
          batchNo: form.batchNo || undefined,
          operatorId: "demo-user-001",
          scannedQuantity: form.scannedQuantity ? parseInt(form.scannedQuantity) : undefined,
          expectedQuantity: form.expectedQuantity ? parseInt(form.expectedQuantity) : undefined,
          damageLevel: form.damageLevel ? parseInt(form.damageLevel) : undefined,
        }),
      });
      const data = await res.json();
      setResult(data);

      if (data.success) {
        if (data.qcResult?.passed) {
          addToast("success", "品控通过，货物正常出库");
        } else if (data.duplicateTicket) {
          addToast("warning", data.message || "该批次存在未关闭品控工单");
        } else {
          addToast("error", `品控异常，工单 ${data.data?.ticket?.ticketNo} 已自动创建`);
        }
      } else {
        addToast("error", data.error || "扫描失败");
      }
    } catch {
      addToast("error", "网络错误");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-ink)] flex items-center gap-3">
          <ScanLine size={28} className="text-[var(--color-accent)]" />
          扫描品控
        </h1>
        <p className="text-sm text-[var(--color-ink-faint)] mt-1">
          模拟扫描枪录入 SKU，系统自动通过 V2 接口校验归属 + 品控规则引擎检测
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scan Form */}
        <div className="card">
          <h3 className="text-base font-bold text-[var(--color-ink)] mb-4">扫描录入</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[var(--color-ink)] mb-1 block">外部编码 *</label>
              <input className="input" placeholder="输入外部编码（如 ORDER-001）" value={form.waybillCode} onChange={(e) => setForm({ ...form, waybillCode: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--color-ink)] mb-1 block">SKU 编码 *</label>
              <input className="input" placeholder="扫描或手动输入 SKU" value={form.skuCode} onChange={(e) => setForm({ ...form, skuCode: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-[var(--color-ink)] mb-1 block">扫描数量</label>
                <input className="input" type="number" placeholder="实际数量" value={form.scannedQuantity} onChange={(e) => setForm({ ...form, scannedQuantity: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--color-ink)] mb-1 block">预期数量</label>
                <input className="input" type="number" placeholder="运单数量" value={form.expectedQuantity} onChange={(e) => setForm({ ...form, expectedQuantity: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-[var(--color-ink)] mb-1 block">批次号</label>
                <input className="input" placeholder="可选" value={form.batchNo} onChange={(e) => setForm({ ...form, batchNo: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--color-ink)] mb-1 block">破损等级 (1-5)</label>
                <input className="input" type="number" min="1" max="5" placeholder="无=正常" value={form.damageLevel} onChange={(e) => setForm({ ...form, damageLevel: e.target.value })} />
              </div>
            </div>
            <button className="btn btn-primary w-full justify-center py-3" onClick={handleScan} disabled={loading}>
              {loading ? <Loader2 size={18} className="animate-spin" /> : <ScanLine size={18} />}
              {loading ? "检测中..." : "执行品控扫描"}
            </button>
          </div>
        </div>

        {/* Result */}
        <div className="card">
          <h3 className="text-base font-bold text-[var(--color-ink)] mb-4">检测结果</h3>
          {!result ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ScanLine size={40} className="text-[var(--color-ink-faint)] mb-3" />
              <p className="text-sm text-[var(--color-ink-faint)]">等待扫描操作...</p>
            </div>
          ) : result.success ? (
            <div>
              {result.qcResult?.passed ? (
                <div className="p-4 rounded-xl bg-[var(--color-success-bg)] border border-[var(--color-success-line)] mb-3">
                  <div className="flex items-center gap-2 text-[var(--color-success-line)] font-semibold">
                    <CheckCircle size={20} />品控通过 - 正常出库
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-[var(--color-danger-bg)] border border-[var(--color-danger-line)] mb-3">
                  <div className="flex items-center gap-2 text-[var(--color-danger-line)] font-semibold mb-2">
                    <AlertTriangle size={20} />品控异常 - 批次暂扣
                  </div>
                  {result.qcResult?.failedRules?.map((r: any, i: number) => (
                    <div key={i} className="text-sm text-[var(--color-danger-line)] mt-1">
                      • {r.description}（严重度: {r.severity}）
                    </div>
                  ))}
                  {result.data?.ticket && (
                    <div className="mt-3 pt-3 border-t border-[var(--color-danger-line)]/20">
                      <span className="text-xs text-[var(--color-ink-faint)]">自动创建工单：</span>
                      <span className="text-sm font-mono font-semibold text-[var(--color-ink)]">{result.data.ticket.ticketNo}</span>
                    </div>
                  )}
                </div>
              )}
              {result.message && (
                <div className="p-3 rounded-lg bg-[var(--color-warn-bg)] text-sm text-[var(--color-warn-line)]">
                  {result.message}
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-[var(--color-danger-bg)] text-sm text-[var(--color-danger-line)]">
              {result.error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
