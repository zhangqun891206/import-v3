// ============================================================
// V3 核心类型定义
// ============================================================

// ---- 工单相关 ----
export type TicketSource = "SCAN_TRIGGER" | "MANUAL_REPORT";
export type TicketCategory = "LOGISTICS" | "QC";
export type TicketStatus =
  | "PENDING"
  | "LEVEL1_APPROVING"
  | "LEVEL2_APPROVING"
  | "EXECUTING"
  | "COMPLETED"
  | "CLOSED";

export type ExceptionType =
  // 物流类
  | "LOST"
  | "DAMAGED"
  | "REJECTED"
  | "TIMEOUT"
  | "ADDRESS_ERROR"
  // 品控类
  | "QC_QUANTITY"
  | "QC_DAMAGED"
  | "QC_SPEC"
  | "QC_LABEL"
  | "QC_BATCH";

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface ExceptionTicket {
  id: string;
  ticketNo: string;
  waybillCode: string;
  ticketSource: TicketSource;
  exceptionType: ExceptionType;
  exceptionCategory: TicketCategory;
  severity: Severity;
  amount: number;
  description?: string;
  aiSuggestion?: string;
  aiConfidence?: number;
  status: TicketStatus;
  timesResubmitted: number;
  maxResubmit: number;
  statusEnteredAt: string;
  dueDate?: string;
  isOverdue: boolean;
  version: number;
  qcFastRelease: boolean;
  qcReleaseReason?: string;
  submittedById: string;
  submittedByName?: string;
  createdAt: string;
  updatedAt: string;
  approvals?: ApprovalRecord[];
  compensation?: CompensationRecord;
  scanRecords?: ScanRecord[];
}

// ---- 审批相关 ----
export type ApprovalAction = "APPROVE" | "REJECT";

export interface ApprovalRecord {
  id: string;
  ticketId: string;
  approverId: string;
  approverName: string;
  approvalLevel: number;
  action: ApprovalAction;
  opinion?: string;
  aiOpinion?: string;
  aiBasis?: string;
  idempotencyKey: string;
  createdAt: string;
}

// ---- 赔付相关 ----
export type CompensationDirection = "TO_CUSTOMER" | "FROM_SUPPLIER";
export type CompensationStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "CANCELLED";

export interface CompensationRecord {
  id: string;
  ticketId: string;
  approvalRecordId: string;
  direction: CompensationDirection;
  amount: number;
  status: CompensationStatus;
  paymentMethod?: string;
  referenceNo?: string;
  supplierName?: string;
  deductionReason?: string;
  priceDiffAmount?: number;
  operatedById: string;
  operatedAt: string;
}

// ---- 扫描相关 ----
export type QcResult = "PASS" | "FAIL";
export type BatchStatus = "SCANNED" | "QC_HOLD" | "RELEASED" | "FORCE_RELEASED";

export interface ScanRecord {
  id: string;
  waybillCode: string;
  skuCode: string;
  batchNo?: string;
  scannedAt: string;
  operatorId: string;
  operatorName?: string;
  deviceId?: string;
  qcResult: QcResult;
  qcRuleMatched?: string;
  qcRuleName?: string;
  qcDescription?: string;
  qcSeverity?: Severity;
  aiSuggestion?: string;
  aiConfidence?: number;
  batchStatus: BatchStatus;
  ticketId?: string;
}

// ---- 品控规则 ----
export type QcRuleType = "QUANTITY_DIFF" | "APPEARANCE_DAMAGE" | "SPEC_MISMATCH" | "LABEL_ERROR" | "BATCH_ABNORMAL";

export interface QcRule {
  id: string;
  name: string;
  ruleType: QcRuleType;
  description?: string;
  thresholdOperator: string;
  thresholdValue: number;
  thresholdValue2?: number;
  thresholdUnit: string;
  severity: Severity;
  autoCreateTicket: boolean;
  autoApprovalLevel: string;
  enabled: boolean;
  priority: number;
}

// ---- 用户相关 ----
export type UserRole = "reporter" | "level1_approver" | "level2_approver" | "qc_supervisor" | "admin";

export interface User {
  id: string;
  name: string;
  role: UserRole;
  warehouse?: string;
  disabled: boolean;
}

// ---- 运单快照 ----
export interface WaybillSnapshot {
  id: string;
  waybillCode: string;
  storeName?: string;
  receiverName?: string;
  receiverPhone?: string;
  receiverAddress?: string;
  totalQuantity: number;
  skuCount: number;
  batchId?: string;
  remark?: string;
  dataSource: string;
  lastSyncAt: string;
  v2UpdatedAt?: string;
}

// ---- V2 API 响应 ----
export interface V2WaybillDetail {
  externalCode: string;
  storeName?: string;
  receiverName?: string;
  receiverPhone?: string;
  receiverAddress?: string;
  batchId: string;
  remark?: string;
  exceptionStatus?: string;
  skuDetails: V2SkuDetail[];
  totalSkuCount: number;
  totalQuantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface V2SkuDetail {
  skuCode: string;
  skuName: string;
  skuQuantity: number;
  skuSpec?: string;
}

export interface V2SkuVerification {
  belongsToOrder: boolean;
  waybillCode: string;
  skuCode: string;
  skuName: string;
  skuSpec?: string;
  totalQuantity: number;
}

// ---- 分页 ----
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ---- API 响应 ----
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}
