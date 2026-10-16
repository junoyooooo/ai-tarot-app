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

// 별똥별 받기 · 별가루 · 꾸미기
export const fetchPlay = () => request('/api/play/state', { timeoutMs: 20000 });
export const playStart = () => request('/api/play/start', { method: 'POST', timeoutMs: 20000 });
export const playClaim = (run_id, score) => request('/api/play/claim', { method: 'POST', body: { run_id, score }, timeoutMs: 20000 });
export const playBuy = (item_id) => request('/api/play/buy', { method: 'POST', body: { item_id } });
export const playEquip = (equipped, main) => request('/api/play/equip', { method: 'POST', body: { equipped, main } });
export const playExchange = () => request('/api/play/exchange', { method: 'POST' });

// 카드 보관함: 계급과 월간 스티커 (상담 수는 서버가 센다)
export const fetchCardbox = () => request('/api/cardbox', { timeoutMs: 20000 });
export const claimCardbox = () => request('/api/cardbox/claim', { method: 'POST', timeoutMs: 20000 });

// 타로 RPG(걱정덩어리): 승패와 피해량은 서버가 정해요
export const rpgStart = () => request('/api/rpg/start', { method: 'POST', timeoutMs: 20000 });
export const rpgTurn = (run_id, action) => request('/api/rpg/turn', { method: 'POST', body: { run_id, action }, timeoutMs: 20000 });

// 재방문 장치: 연속 출석 · 친구 초대 · 웹 푸시
export const fetchRetention = () => request('/api/retention', { timeoutMs: 20000 });
export const postCheckin = () => request('/api/checkin', { method: 'POST', timeoutMs: 20000 });
export const fetchInvite = () => request('/api/invite', { timeoutMs: 20000 });
export const redeemInvite = (code) => request('/api/invite/redeem', { method: 'POST', body: { code }, timeoutMs: 20000 });
export const pushSubscribe = (sub) => request('/api/push/subscribe', { method: 'POST', body: sub, timeoutMs: 20000 });
export const pushUnsubscribe = () => request('/api/push/unsubscribe', { method: 'POST', timeoutMs: 20000 });
