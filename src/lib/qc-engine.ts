import { prisma } from "./prisma";
import type { QcRule, ScanRecord, Severity } from "@/types";

// ============================================================
// 品控规则引擎
// ============================================================
// 完全可配置，无硬编码阈值

export interface QcCheckInput {
  waybillCode: string;
  skuCode: string;
  batchNo?: string;
  // 扫描检测到的数值
  scannedQuantity?: number;
  expectedQuantity?: number;
  damageLevel?: number; // 1-5 破损等级
  specDeviation?: number; // 规格偏差百分比
  labelCorrect?: boolean;
  batchValid?: boolean;
}

export interface QcCheckResult {
  passed: boolean;
  failedRules: Array<{
    ruleId: string;
    ruleName: string;
    ruleType: string;
    severity: Severity;
    description: string;
    autoApprovalLevel: string;
  }>;
}

/**
 * 执行品控规则检查
 * 加载所有启用的规则，逐一匹配，返回命中的规则列表
 */
export async function runQcCheck(input: QcCheckInput): Promise<QcCheckResult> {
  const rules = await prisma.qcRule.findMany({
    where: { enabled: true },
    orderBy: { priority: "desc" },
  });

  const failedRules: QcCheckResult["failedRules"] = [];

  for (const rule of rules) {
    const matched = evaluateRule(rule, input);
    if (matched) {
      failedRules.push({
        ruleId: rule.id,
        ruleName: rule.name,
        ruleType: rule.ruleType,
        severity: rule.severity as Severity,
        description: `${rule.name}: ${generateRuleDescription(rule, input)}`,
        autoApprovalLevel: rule.autoApprovalLevel,
      });
    }
  }

  return {
    passed: failedRules.length === 0,
    failedRules,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function evaluateRule(rule: any, input: QcCheckInput): boolean {
  const op = rule.thresholdOperator;
  const threshold = Number(rule.thresholdValue);
  const threshold2 = rule.thresholdValue2 ? Number(rule.thresholdValue2) : undefined;

  let actualValue: number | null = null;

  switch (rule.ruleType) {
    case "QUANTITY_DIFF":
      if (input.scannedQuantity !== undefined && input.expectedQuantity && input.expectedQuantity > 0) {
        actualValue = Math.abs(input.scannedQuantity - input.expectedQuantity) / input.expectedQuantity * 100;
      }
      break;
    case "APPEARANCE_DAMAGE":
      actualValue = input.damageLevel ?? null;
      break;
    case "SPEC_MISMATCH":
      actualValue = input.specDeviation ?? null;
      break;
    case "LABEL_ERROR":
      return input.labelCorrect === false;
    case "BATCH_ABNORMAL":
      return input.batchValid === false;
  }

  if (actualValue === null) return false;

  return compareThreshold(actualValue, op, threshold, threshold2);
}

function compareThreshold(
  value: number,
  op: string,
  threshold: number,
  threshold2?: number
): boolean {
  switch (op) {
    case "GT": return value > threshold;
    case "LT": return value < threshold;
    case "EQ": return value === threshold;
    case "GTE": return value >= threshold;
    case "LTE": return value <= threshold;
    case "BETWEEN": return threshold2 !== undefined && value >= threshold && value <= threshold2;
    default: return false;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateRuleDescription(rule: any, input: QcCheckInput): string {
  const unit = rule.thresholdUnit === "PERCENT" ? "%" : "";
  const operator = rule.thresholdOperator as string;
  const opText: Record<string, string> = {
    GT: "大于", LT: "小于", EQ: "等于", GTE: "大于等于", LTE: "小于等于", BETWEEN: "介于",
  };

  switch (rule.ruleType) {
    case "QUANTITY_DIFF":
      return `数量差异 ${input.scannedQuantity !== undefined && input.expectedQuantity
        ? `${(Math.abs(input.scannedQuantity - input.expectedQuantity) / input.expectedQuantity * 100).toFixed(1)}%`
        : "未知"}，${opText[operator] || operator}阈值 ${rule.thresholdValue}${unit}`;
    case "APPEARANCE_DAMAGE":
      return `破损等级 ${input.damageLevel} 级，${opText[operator] || operator}阈值 ${rule.thresholdValue}`;
    default:
      return `命中规则条件`;
  }
}
