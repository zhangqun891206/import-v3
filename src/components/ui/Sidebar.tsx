"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ScanLine,
  AlertTriangle,
  CheckCircle,
  ListChecks,
  Activity,
  Settings,
  ClipboardList,
} from "lucide-react";

const navItems = [
  { href: "/", label: "首页概览", icon: Activity },
  { href: "/scan", label: "扫描品控", icon: ScanLine },
  { href: "/tickets/new", label: "异常上报", icon: AlertTriangle },
  { href: "/tickets", label: "工单列表", icon: ListChecks },
  { href: "/approval", label: "审批中心", icon: CheckCircle },
  { href: "/monitor", label: "接口监控", icon: Activity },
  { href: "/rules", label: "品控规则", icon: ClipboardList },
  { href: "/settings", label: "系统配置", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 border-r border-[var(--color-line)] bg-gradient-to-b from-white to-[#F6FBFB] flex flex-col z-50">
      {/* Brand */}
      <div className="p-6 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-accent)] shadow-[0_0_0_4px_var(--color-accent-tint)]" />
          <span className="text-xs tracking-widest text-[var(--color-ink-faint)] font-semibold uppercase">V3 System</span>
        </div>
        <h2 className="text-sm font-bold text-[var(--color-ink)] mt-2">运单全流程管理</h2>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                isActive
                  ? "bg-[var(--color-accent-tint)] text-[var(--color-accent-dark)] font-semibold border-l-2 border-[var(--color-accent)]"
                  : "text-[var(--color-ink-soft)] hover:bg-[var(--color-accent-tint-2)] hover:text-[var(--color-accent-dark)] border-l-2 border-transparent"
              }`}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-dashed border-[var(--color-line)]">
        <p className="text-xs text-[var(--color-ink-faint)]">运单全流程管理系统 V3</p>
        <p className="text-xs text-[var(--color-ink-faint)]">与 V2 通过接口互通</p>
      </div>
    </aside>
  );
}
