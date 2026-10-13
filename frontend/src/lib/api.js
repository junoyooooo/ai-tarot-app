import { getDeviceId } from './device';

export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://ai-tarot-app-tznp.onrender.com';

export class ApiError extends Error {
  constructor(status, code, message, detail = {}) {
    super(message || code || `HTTP ${status}`);
    this.status = status;
    this.code = code || 'error';
    this.detail = detail;
  }
}

export const deviceHeaders = () => ({ 'X-Device-Id': getDeviceId() });

async function request(path, { method = 'GET', body, timeoutMs = 45000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...deviceHeaders() },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* 본문 없음 */
    }
    if (!res.ok) {
      const d = data?.detail;
      if (d && typeof d === 'object') throw new ApiError(res.status, d.code, d.message, d);
      throw new ApiError(res.status, 'error', typeof d === 'string' ? d : '');
    }
    return data;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, 'network', '서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.');
  } finally {
    clearTimeout(timer);
  }
}

export const fetchConfig = () => request('/api/config', { timeoutMs: 20000 });
export const fetchWallet = () => request('/api/wallet', { timeoutMs: 20000 });
export const unlockReading = (id) => request(`/api/reading/${id}/unlock`, { method: 'POST' });
export const requestAdviceCard = (id) => request(`/api/reading/${id}/advice-card`, { method: 'POST', timeoutMs: 60000 });
export const askFollowup = (id, question) => request(`/api/reading/${id}/followup`, { method: 'POST', body: { question }, timeoutMs: 60000 });
export const prepareCheckout = (sku) => request('/api/checkout/prepare', { method: 'POST', body: { sku } });
export const sandboxConfirm = (order_id) => request('/api/checkout/sandbox-confirm', { method: 'POST', body: { order_id } });
export const tossConfirm = (paymentKey, orderId, amount) =>
  request('/api/checkout/confirm', { method: 'POST', body: { paymentKey, orderId, amount }, timeoutMs: 60000 });
