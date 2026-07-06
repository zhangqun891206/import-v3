import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding V3 database...");

  // 1. 创建用户
  const users = [
    { name: "仓库操作员-张三", role: "reporter", warehouse: "WH-001" },
    { name: "仓库操作员-李四", role: "reporter", warehouse: "WH-002" },
    { name: "一级审批-王五", role: "level1_approver", warehouse: "WH-001" },
    { name: "一级审批-赵六", role: "level1_approver", warehouse: "WH-002" },
    { name: "二级审批-陈总", role: "level2_approver", warehouse: "WH-001" },
    { name: "品控主管-钱七", role: "qc_supervisor", warehouse: "WH-001" },
    { name: "系统管理员", role: "admin", warehouse: "WH-001" },
    { name: "demo-user-001", role: "reporter", warehouse: "WH-001" },
    { name: "demo-approver-001", role: "level1_approver", warehouse: "WH-001" },
  ];

  for (const u of users) {
    const existing = await prisma.user.findFirst({ where: { name: u.name } });
    if (!existing) {
      const id = u.name === "demo-user-001" ? "demo-user-001"
        : u.name === "demo-approver-001" ? "demo-approver-001"
        : undefined;
      await prisma.user.create({ data: { id, ...u } });
    }
  }
  console.log(`  ✓ ${users.length} users created`);

  // 2. 创建品控规则
  const qcRules = [
    { name: "数量差异>10%", ruleType: "QUANTITY_DIFF", thresholdOperator: "GT", thresholdValue: 10, thresholdUnit: "PERCENT", severity: "MEDIUM", autoApprovalLevel: "LEVEL1", enabled: true, priority: 10, description: "实际扫描数量与运单数量差异超过10%" },
    { name: "数量差异>30%", ruleType: "QUANTITY_DIFF", thresholdOperator: "GT", thresholdValue: 30, thresholdUnit: "PERCENT", severity: "HIGH", autoApprovalLevel: "LEVEL2", enabled: true, priority: 20, description: "严重数量差异直接进入二级审批" },
    { name: "破损等级≥3", ruleType: "APPEARANCE_DAMAGE", thresholdOperator: "GTE", thresholdValue: 3, thresholdUnit: "LEVEL", severity: "HIGH", autoApprovalLevel: "LEVEL2", enabled: true, priority: 15, description: "货物破损严重（3级以上）直接二级审批" },
    { name: "轻度破损(等级1-2)", ruleType: "APPEARANCE_DAMAGE", thresholdOperator: "BETWEEN", thresholdValue: 1, thresholdValue2: 2, thresholdUnit: "LEVEL", severity: "LOW", autoApprovalLevel: "LEVEL1", enabled: true, priority: 5, description: "轻微破损进入一级审批" },
    { name: "标签错误", ruleType: "LABEL_ERROR", thresholdOperator: "EQ", thresholdValue: 0, thresholdUnit: "ABSOLUTE", severity: "MEDIUM", autoApprovalLevel: "LEVEL1", enabled: true, priority: 8, description: "SKU标签信息不正确" },
  ];

  for (const r of qcRules) {
    const existing = await prisma.qcRule.findFirst({ where: { name: r.name } });
    if (!existing) {
      await prisma.qcRule.create({ data: r });
    }
  }
  console.log(`  ✓ ${qcRules.length} QC rules created`);

  // 3. 创建审批配置
  const configs = [
    { configKey: "level2_threshold", configValue: "5000", description: "金额≥5000自动升级二级审批" },
    { configKey: "approval_timeout_hours", configValue: "24", description: "一级审批超时24小时自动升级" },
    { configKey: "level2_approval_timeout_hours", configValue: "48", description: "二级审批超时48小时自动驳回" },
    { configKey: "qc_hold_timeout_hours", configValue: "4", description: "品控暂扣4小时超时强制升级二级审批" },
    { configKey: "max_resubmit_count", configValue: "3", description: "工单被拒最多重新提交3次" },
  ];

  for (const c of configs) {
    await prisma.approvalConfig.upsert({
      where: { configKey: c.configKey },
      update: c,
      create: c,
    });
  }
  console.log(`  ✓ ${configs.length} configs created`);

  // 4. 模拟运单快照
  const waybills = Array.from({ length: 50 }, (_, i) => ({
    waybillCode: `ORDER-${String(i + 1).padStart(4, "0")}`,
    storeName: `门店-${String.fromCharCode(65 + (i % 26))}`,
    receiverName: `收货人${i + 1}`,
    receiverPhone: `138${String(10000000 + i).slice(0, 8)}`,
    receiverAddress: `广东省广州市天河区${i + 1}号`,
    totalQuantity: Math.floor(Math.random() * 100) + 10,
    skuCount: Math.floor(Math.random() * 5) + 1,
    batchId: `BATCH-${Date.now()}`,
  }));

  for (const w of waybills) {
    await prisma.waybillSnapshot.upsert({
      where: { waybillCode: w.waybillCode },
      update: w,
      create: w,
    });
  }
  console.log(`  ✓ ${waybills.length} waybill snapshots created`);

  // 5. 创建200+条异常工单
  const statuses = ["PENDING", "LEVEL1_APPROVING", "LEVEL2_APPROVING", "EXECUTING", "COMPLETED", "CLOSED"] as const;
  const logisticsTypes = ["LOST", "DAMAGED", "REJECTED", "TIMEOUT", "ADDRESS_ERROR"];
  const ticketSources = ["SCAN_TRIGGER", "MANUAL_REPORT"] as const;
  const categories = ["LOGISTICS", "QC"] as const;

  let ticketCount = 0;

  for (let i = 0; i < 220; i++) {
    const waybill = waybills[i % waybills.length];
    const status = statuses[i % statuses.length];
    const category = categories[Math.floor(Math.random() * categories.length)];
    const exceptionType = category === "LOGISTICS"
      ? logisticsTypes[Math.floor(Math.random() * logisticsTypes.length)]
      : "QC_QUANTITY";
    const source = category === "QC" ? "SCAN_TRIGGER" : "MANUAL_REPORT";
    const amount = ["LOST", "DAMAGED"].includes(exceptionType) ? Math.floor(Math.random() * 10000) + 500 : 0;

    const ticketNo = `TICKET-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(i + 1).padStart(4, "0")}`;

    await prisma.exceptionTicket.upsert({
      where: { ticketNo },
      update: {},
      create: {
        ticketNo,
        waybillCode: waybill.waybillCode,
        ticketSource: source,
        exceptionType,
        exceptionCategory: category,
        severity: amount > 5000 ? "HIGH" : amount > 1000 ? "MEDIUM" : "LOW",
        amount,
        description: `测试工单 #${i + 1}: ${exceptionType}`,
        status,
        timesResubmitted: status === "PENDING" ? Math.floor(Math.random() * 3) : 0,
        statusEnteredAt: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)),
        dueDate: new Date(Date.now() + Math.floor(Math.random() * 48 * 60 * 60 * 1000)),
        isOverdue: Math.random() > 0.8,
        submittedById: "demo-user-001",
      },
    });
    ticketCount++;
  }
  console.log(`  ✓ ${ticketCount} exception tickets created`);

  console.log("\n✅ Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
