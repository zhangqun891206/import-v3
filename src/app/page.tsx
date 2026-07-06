"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, CheckCircle, Clock, ScanLine, Activity,
  TrendingUp, ChevronRight,
} from "lucide-react";

interface DashboardStats {
  totalTickets: number;
  pendingTickets: number;
  qcHoldTickets: number;
  overdueTickets: number;
  completedToday: number;
  apiSuccessRate: string;
}

export default function HomePage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalTickets: 0, pendingTickets: 0, qcHoldTickets: 0,
    overdueTickets: 0, completedToday: 0, apiSuccessRate: "100",
  });

  useEffect(() => {
    fetch("/api/monitor").then((r) => r.json()).then((d) => {
      if (d.success) {
        setStats((prev) => ({
          ...prev,
          totalTickets: d.data.stats.totalTickets,
          apiSuccessRate: d.data.stats.successRate,
        }));
      }
    });
    fetch("/api/tickets?status=PENDING,LEVEL1_APPROVING,LEVEL2_APPROVING&pageSize=1")
      .then((r) => r.json()).then((d) => {
        if (d.success) setStats((prev) => ({ ...prev, pendingTickets: d.data.total }));
      });
  }, []);

  return (
    <div>
      {/* Hero */}
      <div className="mb-8 pb-6 border-b border-[var(--color-line)]">
        <span className="inline-flex items-center gap-2 text-xs tracking-widest uppercase text-[var(--color-accent-dark)] bg-[var(--color-accent-tint)] px-3 py-1 rounded-full font-bold mb-3">
          运单全流程管理系统
        </span>
        <h1 className="text-3xl font-bold text-[var(--color-ink)] mb-2">V3 控制台</h1>
        <p className="text-[var(--color-ink-soft)]">
          录单 <span className="text-[var(--color-accent-dark)] font-semibold">→</span> 扫描品控{" "}
          <span className="text-[var(--color-accent-dark)] font-semibold">→</span> 异常上报{" "}
          <span className="text-[var(--color-accent-dark)] font-semibold">→</span> 分级审批{" "}
          <span className="text-[var(--color-accent-dark)] font-semibold">→</span> 执行联动
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<AlertTriangle size={20} className="text-[var(--color-warn-line)]" />}
          label="待处理工单"
          value={stats.pendingTickets}
          color="warn"
          href="/approval"
        />
        <StatCard
          icon={<ScanLine size={20} className="text-[var(--color-accent-dark)]" />}
          label="品控暂扣批次"
          value={stats.qcHoldTickets}
          color="accent"
          href="/scan"
        />
        <StatCard
          icon={<Clock size={20} className="text-[var(--color-danger-line)]" />}
          label="超时工单"
          value={stats.overdueTickets}
          color="danger"
          href="/tickets?status=overdue"
        />
        <StatCard
          icon={<Activity size={20} className="text-[var(--color-success-line)]" />}
          label="V2 接口成功率"
          value={stats.apiSuccessRate}
          unit="%"
          color="success"
          href="/monitor"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <QuickAction href="/scan" icon={<ScanLine size={22} />} label="扫描品控" desc="扫描SKU+品控检测" />
        <QuickAction href="/tickets/new" icon={<AlertTriangle size={22} />} label="异常上报" desc="手工上报物流异常" />
        <QuickAction href="/approval" icon={<CheckCircle size={22} />} label="审批中心" desc="分级审批处理" />
        <QuickAction href="/tickets" icon={<TrendingUp size={22} />} label="工单追踪" desc="全量工单查询" />
      </div>

      {/* Overview */}
      <div className="card">
        <h3 className="text-base font-bold text-[var(--color-ink)] mb-4">系统概述</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-[var(--color-ink-soft)]">
          <div className="space-y-2">
            <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />运单数据通过 HTTP API 实时从 V2 系统同步</div>
            <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />品控扫描自动触发规则引擎，暂扣异常批次</div>
            <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />分级审批引擎支持一/二级审批 + 并发冲突保护</div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />审批通过后联动赔付与库存变更（事务保证一致性）</div>
            <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />品控规则完全可配置，延续 V2 规则引擎设计理念</div>
            <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />V2 接口不可用时降级使用本地缓存（标注数据来源）</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, unit, color, href }: {
  icon: React.ReactNode; label: string; value: number | string; unit?: string; color: string; href: string;
}) {
  const borders: Record<string, string> = {
    accent: "border-l-[var(--color-accent)]",
    warn: "border-l-[var(--color-warn-line)]",
    danger: "border-l-[var(--color-danger-line)]",
    success: "border-l-[var(--color-success-line)]",
  };
  return (
    <Link href={href} className={`card !p-5 border-l-4 ${borders[color]} hover:shadow-md transition-shadow cursor-pointer block`}>
      <div className="flex items-center justify-between mb-2">
        {icon}
        <ChevronRight size={16} className="text-[var(--color-ink-faint)]" />
      </div>
      <div className="text-2xl font-bold text-[var(--color-ink)]">{value}{unit}</div>
      <div className="text-xs text-[var(--color-ink-faint)] mt-1">{label}</div>
    </Link>
  );
}

function QuickAction({ href, icon, label, desc }: {
  href: string; icon: React.ReactNode; label: string; desc: string;
}) {
  return (
    <Link href={href} className="card !p-5 hover:border-[var(--color-accent)] hover:shadow-md transition-all cursor-pointer block group">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-tint)] flex items-center justify-center text-[var(--color-accent-dark)] group-hover:bg-[var(--color-accent)] group-hover:text-white transition-colors">
          {icon}
        </div>
        <span className="font-semibold text-[var(--color-ink)]">{label}</span>
      </div>
      <p className="text-xs text-[var(--color-ink-faint)]">{desc}</p>
    </Link>
  );
}
