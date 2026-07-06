import { v4 as uuidv4 } from "uuid";
import type {
  V2WaybillDetail,
  V2SkuVerification,
  ApiResponse,
} from "@/types";

const V2_API_BASE = process.env.V2_API_BASE || "http://localhost:3001/api";
const V2_API_KEY = process.env.V2_API_KEY || "";
const V2_TIMEOUT_MS = 10000; // 10秒超时
const MAX_RETRIES = 2;

// ============================================================
// 接口同步日志（写入数据库）
// ============================================================
import { prisma } from "./prisma";

interface LogApiCallParams {
  requestId: string;
  apiName: string;
  waybillCode?: string;
  requestSummary?: string;
  responseStatus: number;
  success: boolean;
  durationMs: number;
  errorMessage?: string;
  errorType?: string;
  isRetry?: boolean;
  retryCount?: number;
}

async function logApiCall(params: LogApiCallParams) {
  try {
    await prisma.apiSyncLog.create({
      data: {
        requestId: params.requestId,
        apiName: params.apiName,
        waybillCode: params.waybillCode,
        requestSummary: params.requestSummary,
        responseStatus: params.responseStatus,
        success: params.success,
        durationMs: params.durationMs,
        errorMessage: params.errorMessage,
        errorType: params.errorType,
        isRetry: params.isRetry || false,
        retryCount: params.retryCount || 0,
      },
    });
  } catch {
    // 日志写入失败不阻塞主流程
    console.error("[V2Client] Failed to write API sync log");
  }
}

// ============================================================
// 通用 HTTP 调用
// ============================================================
async function fetchWithAuth(
  url: string,
  options: RequestInit = {},
  retryCount = 0
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  // API Key 鉴权
  if (V2_API_KEY) {
    headers["Authorization"] = `Bearer ${V2_API_KEY}`;
    headers["x-api-key"] = V2_API_KEY;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), V2_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    // 重试逻辑
    if (retryCount < MAX_RETRIES) {
      console.warn(`[V2Client] Retry ${retryCount + 1}/${MAX_RETRIES} for ${url}`);
      await new Promise((r) => setTimeout(r, 500 * (retryCount + 1)));
      return fetchWithAuth(url, options, retryCount + 1);
    }

    throw error;
  }
}

// ============================================================
// 1. 校验运单存在 + 获取运单详情
// ============================================================
export async function getWaybillDetail(
  waybillCode: string
): Promise<{ data?: V2WaybillDetail; error?: string; fromCache?: boolean }> {
  const requestId = uuidv4();
  const startTime = Date.now();

  try {
    const response = await fetchWithAuth(
      `${V2_API_BASE}/orders/${encodeURIComponent(waybillCode)}`
    );
    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      await logApiCall({
        requestId,
        apiName: "getWaybillDetail",
        waybillCode,
        responseStatus: response.status,
        success: false,
        durationMs,
        errorMessage: `HTTP ${response.status}`,
        errorType: response.status === 404 ? "HTTP_404" : `HTTP_${response.status}`,
      });

      if (response.status === 404) {
        return { error: "运单不存在" };
      }
      return { error: `V2 接口返回错误: HTTP ${response.status}` };
    }

    const result: ApiResponse<V2WaybillDetail> = await response.json();

    await logApiCall({
      requestId,
      apiName: "getWaybillDetail",
      waybillCode,
      responseStatus: response.status,
      success: result.success,
      durationMs,
    });

    if (!result.success || !result.data) {
      return { error: result.error || "获取运单详情失败" };
    }

    return { data: result.data };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const isTimeout = error instanceof DOMException && error.name === "AbortError";

    await logApiCall({
      requestId,
      apiName: "getWaybillDetail",
      waybillCode,
      responseStatus: 0,
      success: false,
      durationMs,
      errorMessage: isTimeout ? "请求超时" : String(error),
      errorType: isTimeout ? "NETWORK_TIMEOUT" : "NETWORK_ERROR",
    });

    return { error: isTimeout ? "V2 接口请求超时" : "网络错误，无法连接 V2 服务" };
  }
}

// ============================================================
// 2. SKU 归属运单校验
// ============================================================
export async function verifySkuBelongsToOrder(
  waybillCode: string,
  skuCode: string
): Promise<{ data?: V2SkuVerification; error?: string }> {
  const requestId = uuidv4();
  const startTime = Date.now();

  try {
    const response = await fetchWithAuth(
      `${V2_API_BASE}/orders/${encodeURIComponent(waybillCode)}/sku/${encodeURIComponent(skuCode)}`
    );
    const durationMs = Date.now() - startTime;
    const result: ApiResponse<V2SkuVerification> = await response.json();

    await logApiCall({
      requestId,
      apiName: "verifySku",
      waybillCode,
      requestSummary: `SKU: ${skuCode}`,
      responseStatus: response.status,
      success: result.success,
      durationMs,
      errorMessage: result.error,
      errorType: response.status === 404 ? "HTTP_404" : undefined,
    });

    if (!result.success || !result.data) {
      return { error: result.error || "SKU 校验失败" };
    }

    return { data: result.data };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const isTimeout = error instanceof DOMException && error.name === "AbortError";

    await logApiCall({
      requestId,
      apiName: "verifySku",
      waybillCode,
      responseStatus: 0,
      success: false,
      durationMs,
      errorMessage: isTimeout ? "请求超时" : String(error),
      errorType: isTimeout ? "NETWORK_TIMEOUT" : "NETWORK_ERROR",
    });

    return { error: isTimeout ? "V2 接口请求超时" : "网络错误，无法连接 V2 服务" };
  }
}

// ============================================================
// 3. 异常状态回写 V2
// ============================================================
export async function writebackExceptionStatus(
  waybillCode: string,
  exceptionStatus: "pending" | "resolved",
  ticketId: string
): Promise<{ success: boolean; error?: string }> {
  const requestId = uuidv4();
  const startTime = Date.now();

  try {
    const response = await fetchWithAuth(
      `${V2_API_BASE}/orders/${encodeURIComponent(waybillCode)}/exception`,
      {
        method: "PATCH",
        body: JSON.stringify({ exceptionStatus, ticketId }),
      }
    );
    const durationMs = Date.now() - startTime;
    const result: ApiResponse = await response.json();

    await logApiCall({
      requestId,
      apiName: "writebackException",
      waybillCode,
      requestSummary: `Status: ${exceptionStatus}, Ticket: ${ticketId}`,
      responseStatus: response.status,
      success: result.success,
      durationMs,
      errorMessage: result.error,
    });

    return { success: result.success, error: result.error };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const isTimeout = error instanceof DOMException && error.name === "AbortError";

    await logApiCall({
      requestId,
      apiName: "writebackException",
      waybillCode,
      responseStatus: 0,
      success: false,
      durationMs,
      errorMessage: isTimeout ? "请求超时" : String(error),
      errorType: isTimeout ? "NETWORK_TIMEOUT" : "NETWORK_ERROR",
    });

    return { success: false, error: isTimeout ? "V2 接口请求超时" : "网络错误" };
  }
}

// ============================================================
// 判断 V2 服务是否可用
// ============================================================
let v2Available = true;
let lastV2Check = 0;

export function isV2Available(): boolean {
  // 缓存 30 秒
  if (Date.now() - lastV2Check < 30000) return v2Available;
  return v2Available;
}

export function setV2Available(available: boolean) {
  v2Available = available;
  lastV2Check = Date.now();
}
