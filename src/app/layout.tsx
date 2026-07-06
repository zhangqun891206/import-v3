import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/ui/Sidebar";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "运单全流程管理系统 V3",
  description: "录单 → 扫描品控 → 异常上报 → 分级审批 → 执行联动",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <ToastProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 ml-64 min-w-0">
              <div className="p-8 max-w-7xl mx-auto">
                {children}
              </div>
            </main>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
