"use client";

import { useEffect, useState } from "react";
import { Settings, Save, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

const CONFIG_ITEMS = [
  { key: "level1_threshold", label: "一级审批金额阈值 (¥)", defaultValue: "1000", desc: "低于此金额的工单只需一级审批" },
  { key: "level2_threshold", label: "二级审批金额阈值 (¥)", defaultValue: "5000", desc: "≥此金额自动升级二级审批" },
  { key: "approval_timeout_hours", label: "审批超时时长 (小时)", defaultValue: "24", desc: "一级审批超时后自动升级" },
  { key: "level2_approval_timeout_hours", label: "二级审批超时时长 (小时)", defaultValue: "48", desc: "二级审批超时后自动驳回" },
  { key: "qc_hold_timeout_hours", label: "品控暂扣超时时长 (小时)", defaultValue: "4", desc: "品控暂扣超时强制升级二级审批（应远短于审批超时）" },
  { key: "max_resubmit_count", label: "重新提交次数上限", defaultValue: "3", desc: "工单被拒绝后允许重新提交的最大次数" },
];

export default function SettingsPage() {
  const { addToast } = useToast();
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => {
      if (d.success) {
        const map: Record<string, string> = {};
        d.data.forEach((c: any) => { map[c.configKey] = c.configValue; });
        setConfigs(map);
      }
      setLoading(false);
    });
  }, []);

  const handleSave = async (key: string) => {
    setSaving(key);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          configKey: key,
          configValue: configs[key],
          description: CONFIG_ITEMS.find((c) => c.key === key)?.desc,
        }),
      });
      const data = await res.json();
      if (data.success) {
        addToast("success", "配置已保存");
      } else {
        addToast("error", data.error || "保存失败");
      }
    } catch {
      addToast("error", "网络错误");
    } finally {
      setSaving(null);
    }
  };

  const getValue = (key: string) => configs[key] || CONFIG_ITEMS.find((c) => c.key === key)?.defaultValue || "";

  if (loading) return <div className="p-8 text-center text-[var(--color-ink-faint)]">加载中...</div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-ink)] flex items-center gap-3">
          <Settings size={28} className="text-[var(--color-accent)]" />
          系统配置
        </h1>
        <p className="text-sm text-[var(--color-ink-faint)] mt-1">
          可配置的分级审批阈值与超时参数 · 无需修改代码
        </p>
      </div>

      <div className="space-y-4 max-w-2xl">
        {CONFIG_ITEMS.map((item) => (
          <div key={item.key} className="card">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <label className="text-sm font-semibold text-[var(--color-ink)]">{item.label}</label>
                <p className="text-xs text-[var(--color-ink-faint)] mt-1">{item.desc}</p>
                <div className="flex items-center gap-2 mt-3">
                  <input
                    className="input !w-32"
                    type="number"
                    min="0"
                    value={getValue(item.key)}
                    onChange={(e) => setConfigs({ ...configs, [item.key]: e.target.value })}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={() => handleSave(item.key)}
                    disabled={saving === item.key}
                  >
                    {saving === item.key ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    保存
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
