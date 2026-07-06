"use client";

import { useEffect, useState } from "react";
import { ClipboardList, Plus, Power, PowerOff, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";

const RULE_TYPES = [
  { value: "QUANTITY_DIFF", label: "数量差异" },
  { value: "APPEARANCE_DAMAGE", label: "外观破损" },
  { value: "SPEC_MISMATCH", label: "规格不符" },
  { value: "LABEL_ERROR", label: "标签错误" },
  { value: "BATCH_ABNORMAL", label: "批次异常" },
];

export default function RulesPage() {
  const { addToast } = useToast();
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editRule, setEditRule] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "", ruleType: "QUANTITY_DIFF", severity: "MEDIUM",
    thresholdOperator: "GT", thresholdValue: "10", thresholdUnit: "PERCENT",
    autoApprovalLevel: "LEVEL1", enabled: true, priority: "0", description: "",
  });

  const fetchRules = async () => {
    setLoading(true);
    const res = await fetch("/api/rules");
    const data = await res.json();
    if (data.success) setRules(data.data);
    setLoading(false);
  };

  useEffect(() => { fetchRules(); }, []);

  const openEdit = (rule: any) => {
    setEditRule(rule);
    setForm({
      name: rule.name, ruleType: rule.ruleType, severity: rule.severity,
      thresholdOperator: rule.thresholdOperator, thresholdValue: String(rule.thresholdValue),
      thresholdUnit: rule.thresholdUnit, autoApprovalLevel: rule.autoApprovalLevel,
      enabled: rule.enabled, priority: String(rule.priority), description: rule.description || "",
    });
    setShowModal(true);
  };

  const openNew = () => {
    setEditRule(null);
    setForm({ name: "", ruleType: "QUANTITY_DIFF", severity: "MEDIUM", thresholdOperator: "GT", thresholdValue: "10", thresholdUnit: "PERCENT", autoApprovalLevel: "LEVEL1", enabled: true, priority: "0", description: "" });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {
        ...form,
        thresholdValue: parseFloat(form.thresholdValue),
        priority: parseInt(form.priority),
      };
      const res = await fetch("/api/rules", {
        method: editRule ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editRule ? { id: editRule.id, ...body } : body),
      });
      const data = await res.json();
      if (data.success) {
        addToast("success", editRule ? "规则已更新" : "规则已创建");
        setShowModal(false);
        fetchRules();
      } else {
        addToast("error", data.error || "操作失败");
      }
    } catch {
      addToast("error", "网络错误");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-ink)] flex items-center gap-3">
            <ClipboardList size={28} className="text-[var(--color-accent)]" />
            品控规则配置
          </h1>
          <p className="text-sm text-[var(--color-ink-faint)] mt-1">
            可配置的品控触发规则 · 延续 V2 规则引擎设计理念 · 不允许硬编码
          </p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          <Plus size={16} /> 新增规则
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-[var(--color-ink-faint)]">加载中...</div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div key={rule.id} className="card flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-semibold text-sm">{rule.name}</span>
                  <span className="badge badge-accent">{RULE_TYPES.find((t) => t.value === rule.ruleType)?.label}</span>
                  <span className="badge badge-ghost">{rule.severity}</span>
                  {rule.enabled ? (
                    <Power size={14} className="text-[var(--color-success-line)]" />
                  ) : (
                    <PowerOff size={14} className="text-[var(--color-ink-faint)]" />
                  )}
                </div>
                <p className="text-xs text-[var(--color-ink-faint)]">
                  条件: {rule.thresholdOperator} {rule.thresholdValue}{rule.thresholdUnit === "PERCENT" ? "%" : ""} ·
                  审批: {rule.autoApprovalLevel} · 优先级: {rule.priority}
                </p>
              </div>
              <button className="btn btn-secondary text-xs" onClick={() => openEdit(rule)}>编辑</button>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editRule ? "编辑规则" : "新增品控规则"} maxWidth="600px">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">规则名称</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如：数量差异超过10%" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">规则类型</label>
              <select className="input" value={form.ruleType} onChange={(e) => setForm({ ...form, ruleType: e.target.value })}>
                {RULE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">严重度</label>
              <select className="input" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                <option value="LOW">低</option><option value="MEDIUM">中</option><option value="HIGH">高</option><option value="CRITICAL">严重</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">比较方式</label>
              <select className="input" value={form.thresholdOperator} onChange={(e) => setForm({ ...form, thresholdOperator: e.target.value })}>
                <option value="GT">大于</option><option value="GTE">大于等于</option><option value="LT">小于</option><option value="LTE">小于等于</option><option value="EQ">等于</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">阈值</label>
              <input className="input" type="number" value={form.thresholdValue} onChange={(e) => setForm({ ...form, thresholdValue: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">单位</label>
              <select className="input" value={form.thresholdUnit} onChange={(e) => setForm({ ...form, thresholdUnit: e.target.value })}>
                <option value="PERCENT">百分比 %</option><option value="ABSOLUTE">绝对值</option><option value="LEVEL">等级</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">审批层级</label>
              <select className="input" value={form.autoApprovalLevel} onChange={(e) => setForm({ ...form, autoApprovalLevel: e.target.value })}>
                <option value="LEVEL1">一级审批</option><option value="LEVEL2">二级审批</option><option value="DIRECT_LEVEL2">直接二级审批</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">优先级</label>
              <input className="input" type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">描述</label>
            <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex gap-2 pt-2">
            <button className="btn btn-primary flex-1 justify-center py-2.5" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              {editRule ? "保存修改" : "创建规则"}
            </button>
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>取消</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
