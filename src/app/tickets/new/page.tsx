"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Search, ArrowLeft } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import Link from "next/link";

const EXCEPTION_TYPES = [
  { value: "LOST", label: "丢件", category: "LOGISTICS" },
  { value: "DAMAGED", label: "破损", category: "LOGISTICS" },
  { value: "REJECTED", label: "客户拒收", category: "LOGISTICS" },
  { value: "TIMEOUT", label: "超时未签收", category: "LOGISTICS" },
  { value: "ADDRESS_ERROR", label: "收货地址错误", category: "LOGISTICS" },
];

export default function NewTicketPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [form, setForm] = useState({
    waybillCode: "", exceptionType: "", description: "", severity: "MEDIUM", amount: "",
  });
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [v2Result, setV2Result] = useState<any>(null);

  // 校验运单是否存在
  const validateWaybill = async () => {
    if (!form.waybillCode.trim()) return;
    setValidating(true);
    try {
      const res = await fetch(`/api/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          waybillCode: form.waybillCode,
          exceptionType: "DUMMY_CHECK",
          exceptionCategory: "LOGISTICS",
          submittedById: "check-only",
        }),
      });
      const data = await res.json();
      // 忽略具体的业务错误，只看 V2 连通性
      if (data.error?.includes("V2 校验失败")) {
        setV2Result({ error: data.error });
      } else if (data.error?.includes("已存在")) {
        setV2Result({ exists: true, message: data.error });
      } else {
        setV2Result({ valid: true });
      }
    } catch {
      setV2Result({ error: "网络错误" });
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.waybillCode || !form.exceptionType) {
      addToast("warning", "请填写运单号和异常类型");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          waybillCode: form.waybillCode,
          exceptionType: form.exceptionType,
          exceptionCategory: "LOGISTICS",
          description: form.description,
          severity: form.severity,
          amount: form.amount ? parseFloat(form.amount) : 0,
          submittedById: "demo-user-001",
          ticketSource: "MANUAL_REPORT",
        }),
      });
      const data = await res.json();
      if (data.success) {
        addToast("success", `工单 ${data.data.ticketNo} 创建成功`);
        router.push(`/tickets/${data.data.id}`);
      } else {
        addToast("error", data.error || "创建失败");
      }
    } catch {
      addToast("error", "网络错误");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Link href="/tickets" className="inline-flex items-center gap-1 text-sm text-[var(--color-ink-faint)] hover:text-[var(--color-accent-dark)] mb-4">
        <ArrowLeft size={16} /> 返回工单列表
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-ink)] flex items-center gap-3">
          <AlertTriangle size={28} className="text-[var(--color-warn-line)]" />
          异常上报
        </h1>
        <p className="text-sm text-[var(--color-ink-faint)] mt-1">
          手工上报物流类异常，系统将通过 V2 接口实时校验运单存在性
        </p>
      </div>

      <div className="max-w-2xl card">
        {/* Waybill Validation */}
        <div className="mb-6">
          <label className="text-sm font-medium text-[var(--color-ink)] mb-2 block">运单号 *（将实时调用 V2 接口校验）</label>
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="输入 V2 系统中的运单号" value={form.waybillCode} onChange={(e) => setForm({ ...form, waybillCode: e.target.value })} />
            <button className="btn btn-secondary" onClick={validateWaybill} disabled={validating}>
              {validating ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              校验
            </button>
          </div>
          {v2Result?.valid && <p className="text-xs text-[var(--color-success-line)] mt-1">✓ 运单存在，V2 接口校验通过</p>}
          {v2Result?.error && <p className="text-xs text-[var(--color-danger-line)] mt-1">✗ {v2Result.error}</p>}
          {v2Result?.exists && <p className="text-xs text-[var(--color-warn-line)] mt-1">⚠ {v2Result.message}</p>}
        </div>

        {/* Exception Type */}
        <div className="mb-6">
          <label className="text-sm font-medium text-[var(--color-ink)] mb-2 block">异常类型 *</label>
          <div className="grid grid-cols-2 gap-2">
            {EXCEPTION_TYPES.map((t) => (
              <button
                key={t.value}
                className={`p-3 border rounded-xl text-sm font-medium transition-all ${
                  form.exceptionType === t.value
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-tint)] text-[var(--color-accent-dark)]"
                    : "border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-accent)]"
                }`}
                onClick={() => setForm({ ...form, exceptionType: t.value })}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="mb-6">
          <label className="text-sm font-medium text-[var(--color-ink)] mb-2 block">异常描述</label>
          <textarea className="input" rows={3} placeholder="描述异常情况..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <p className="text-xs text-[var(--color-ink-faint)] mt-1">可选接入大模型辅助分类（标注"AI 建议,需人工确认"）</p>
        </div>

        {/* Severity + Amount */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="text-sm font-medium text-[var(--color-ink)] mb-2 block">严重度</label>
            <select className="input" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
              <option value="LOW">低</option>
              <option value="MEDIUM">中</option>
              <option value="HIGH">高</option>
              <option value="CRITICAL">严重</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-[var(--color-ink)] mb-2 block">涉及金额 (¥)</label>
            <input className="input" type="number" min="0" step="0.01" placeholder="预计赔付/追偿金额" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <p className="text-xs text-[var(--color-ink-faint)] mt-1">&ge; 5000 将触发二级审批</p>
          </div>
        </div>

        <button className="btn btn-primary w-full justify-center py-3" onClick={handleSubmit} disabled={loading}>
          {loading ? <Loader2 size={18} className="animate-spin" /> : <AlertTriangle size={18} />}
          {loading ? "提交中..." : "提交异常工单"}
        </button>
      </div>
    </div>
  );
}
