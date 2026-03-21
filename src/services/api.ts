/**
 * Central API client.
 * All requests go through `apiFetch` which auto-attaches the JWT,
 * handles 401 logout, and throws a typed ApiError on failure.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Config ────────────────────────────────────────────────────────────────────
// Backend base URL (production domain).
export const BASE_URL = 'https://api.samitweb.xyz';

const TOKEN_KEY = 'av_access_token';

// ── Token helpers ─────────────────────────────────────────────────────────────
export const saveToken  = (t: string) => AsyncStorage.setItem(TOKEN_KEY, t);
export const getToken   = ()           => AsyncStorage.getItem(TOKEN_KEY);
export const clearToken = ()           => AsyncStorage.removeItem(TOKEN_KEY);

// ── Error type ────────────────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────
type OnUnauthorized = () => void;
let _onUnauthorized: OnUnauthorized | null = null;
export const setUnauthorizedHandler = (fn: OnUnauthorized) => { _onUnauthorized = fn; };

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {headers.Authorization = `Bearer ${token}`;}

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {...options, headers});
  } catch (err: any) {
    // Helps diagnose wrong BASE_URL / adb reverse / network security issues.
    throw new ApiError(0, `Network request failed: ${err?.message ?? String(err)}`);
  }

  if (res.status === 401) {
    _onUnauthorized?.();
    throw new ApiError(401, 'Unauthorized');
  }
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const body = await res.json(); msg = body.detail ?? body.message ?? msg; } catch {}
    throw new ApiError(res.status, msg);
  }
  if (res.status === 204) {return undefined as T;}
  return res.json() as Promise<T>;
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Auth ──────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

export interface RegisterPayload { username: string; email: string; password: string; }
export interface LoginPayload    { email: string; password: string; }
export interface AuthResponse    { access_token: string; token_type: string; }
export interface UserProfile {
  id: string;
  username: string;
  email: string;
  // backend may return `full_name` instead of `username`
  full_name?: string;
}

export const authApi = {
  register: (body: RegisterPayload) =>
    apiFetch<AuthResponse>('/api/v1/auth/register', {method: 'POST', body: JSON.stringify(body)}),

  login: (body: LoginPayload) =>
    apiFetch<AuthResponse>('/api/v1/auth/login', {method: 'POST', body: JSON.stringify(body)}),

  me: async () => {
    const r = await apiFetch<any>('/api/v1/auth/me');
    // Common shapes: {id, username, email} OR {data: {...}} OR {user: {...}}
    const u = r?.data ?? r?.user ?? r;
    return {
      id: u?.id ?? '',
      username: u?.username ?? u?.full_name ?? u?.name ?? '',
      email: u?.email ?? '',
      full_name: u?.full_name,
    } as UserProfile;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ── Devices / FCM ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

export const devicesApi = {
  registerFcm: (token: string) =>
    apiFetch<void>('/api/v1/devices/register-fcm', {
      method: 'POST',
      body: JSON.stringify({token}),
    }),
};

// ─────────────────────────────────────────────────────────────────────────────
// ── Notifications preferences ─────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

export interface NotifPrefs {
  channels: { fcm: { enabled: boolean }; websocket: { enabled: boolean } };
  by_type:  { event: string[] };
}

export const notifApi = {
  getPrefs: () => apiFetch<NotifPrefs>('/api/v1/notifications/preferences'),
  updatePrefs: (body: Partial<NotifPrefs>) =>
    apiFetch<NotifPrefs>('/api/v1/notifications/preferences', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  enableFcm: () =>
    notifApi.updatePrefs({
      channels: {fcm: {enabled: true}, websocket: {enabled: true}},
      by_type:  {event: ['fcm', 'websocket']},
    }),
};

// ─────────────────────────────────────────────────────────────────────────────
// ── Cameras ───────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

export interface Camera {
  id: string;
  name: string;
  location?: string;
  status: 'live' | 'offline' | 'paused';
  stream_url?: string;
}

function unwrapArray<T = unknown>(value: any): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value?.data && Array.isArray(value.data)) return value.data as T[];
  if (value?.events && Array.isArray(value.events)) return value.events as T[];
  if (value?.cameras && Array.isArray(value.cameras)) return value.cameras as T[];
  if (value?.agents && Array.isArray(value.agents)) return value.agents as T[];
  if (value?.items && Array.isArray(value.items)) return value.items as T[];
  if (value?.results && Array.isArray(value.results)) return value.results as T[];
  // some APIs nest one more level: { data: { items: [...] } }
  if (value?.data?.items && Array.isArray(value.data.items)) return value.data.items as T[];
  return [];
}

export const camerasApi = {
  list: async () => {
    const r = await apiFetch<any>('/api/v1/cameras/list');
    return unwrapArray<Camera>(r);
  },
  snapshot: (cameraId: string) => `${BASE_URL}/api/v1/cameras/${cameraId}/snapshot`,
};

/** Snapshot GET URL with JWT query (same pattern as `layout/chatbot-zone-editor.js` image fetch). */
export async function getAuthenticatedCameraSnapshotUrl(cameraId: string): Promise<string> {
  const path = `/api/v1/cameras/${encodeURIComponent(cameraId)}/snapshot`;
  const t = await getToken();
  const u = `${BASE_URL}${path}`;
  if (!t) {
    return u;
  }
  return `${u}${u.includes('?') ? '&' : '?'}token=${encodeURIComponent(t)}`;
}

/**
 * Append JWT query param for authenticated GETs (`<Image source>`, video, file links).
 * Mirrors `layout/chatbot-attachments.js` `addAuthTokenToUrl`.
 */
export async function urlWithAuthForMedia(url: string | null | undefined): Promise<string> {
  if (url == null || url === '') {
    return '';
  }
  const t = await getToken();
  const absolute =
    url.startsWith('http://') || url.startsWith('https://')
      ? url
      : `${BASE_URL.replace(/\/$/, '')}${url.startsWith('/') ? '' : '/'}${url}`;
  if (!t) {
    return absolute;
  }
  const sep = absolute.includes('?') ? '&' : '?';
  return `${absolute}${sep}token=${encodeURIComponent(t)}`;
}

/**
 * Mobile live stream URL (MPEG-TS over HTTP, chunked stream).
 * No file-based HLS segments => avoids Windows file-lock/race issues.
 * GET /api/v1/streams/{camera_id}/live.ts
 */
export function streamsLiveMpegTsUrl(cameraId: string): string {
  return `${BASE_URL}/api/v1/streams/${encodeURIComponent(cameraId)}/live.ts`;
}

/**
 * WebSocket URL for raw camera fMP4 live stream (JWT must be query param `token`).
 * Optional: use only if you need fMP4/MSE; normal mobile playback uses {@link streamsLiveMpegTsUrl}.
 */
export function streamsLiveWsUrl(cameraId: string, token: string): string {
  const isHttps = BASE_URL.startsWith('https');
  const hostAndPath = BASE_URL.replace(/^https?:\/\//, '');
  const proto = isHttps ? 'wss' : 'ws';
  return `${proto}://${hostAndPath}/api/v1/streams/${encodeURIComponent(cameraId)}/live/ws?token=${encodeURIComponent(token)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Agents ────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

export interface Agent {
  id: string;
  name: string;
  camera_id?: string;
  camera_name?: string;
  type: string;
  status: 'active' | 'paused' | 'stopped';
}

export const agentsApi = {
  list: async () => {
    const r = await apiFetch<any>('/api/v1/agents/list');
    return unwrapArray<Agent>(r);
  },
  /** Same endpoint; exposes `total` when the backend returns `{ total, items }`. */
  listWithTotal: async (): Promise<{agents: Agent[]; total: number}> => {
    const r = await apiFetch<any>('/api/v1/agents/list');
    const agents = unwrapArray<Agent>(r);
    const total =
      typeof r?.total === 'number'
        ? r.total
        : typeof r?.data?.total === 'number'
          ? r.data.total
          : agents.length;
    return {agents, total};
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ── Events ────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

export type EventRange = 'today' | 'yesterday' | 'all';

export interface AppEvent {
  id: string;
  camera_id?: string;
  camera_name?: string;
  // Backend uses `label`, UI currently uses `event_type`
  label?: string;
  event_type: string;
  // Backend can return `info` (example) instead of `high/medium/low`
  severity: string;
  // Backend uses `event_ts`
  timestamp: string;
  received_at?: string;
  description?: string;
  has_image?: boolean;
}

export const eventsApi = {
  list: async (range: EventRange = 'today', limit = 50, skip = 0) => {
    const r = await apiFetch<any>(`/api/v1/events?range=${range}&limit=${limit}&skip=${skip}`);
    const rawItems = unwrapArray<any>(r);
    return rawItems.map((it: any): AppEvent => {
      const id = String(it?.id ?? it?.event_id ?? '');
      const event_ts =
        it?.event_ts ??
        it?.eventTs ??
        it?.timestamp ??
        it?.ts ??
        new Date().toISOString();

      return {
        id,
        camera_id: it?.camera_id ?? it?.cameraId ?? '',
        camera_name: it?.camera_name ?? it?.cameraName,
        label: it?.label ?? it?.name,
        event_type: it?.label ?? it?.event_type ?? it?.name ?? 'Event',
        severity: String(it?.severity ?? 'info'),
        timestamp: String(event_ts),
        received_at: it?.received_at ?? it?.receivedAt,
        description: it?.description ?? it?.message,
        has_image: it?.has_image ?? it?.hasImage,
      } as AppEvent;
    });
  },

  // Some backends can read JWT from query params (similar to your websocket).
  // If not supported, this will still 401 and we’ll need a small backend tweak
  // or fetch+blob workaround.
  imageUrl: (eventId: string, token?: string) =>
    token
      ? `${BASE_URL}/api/v1/events/${eventId}/image?token=${encodeURIComponent(token)}`
      : `${BASE_URL}/api/v1/events/${eventId}/image`,
};

// ─────────────────────────────────────────────────────────────────────────────
// ── Chat ──────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/** Resume payload for agent HITL (matches Electron `chatbot-core.js` stream resume). */
export interface AgentResumeDecision {
  type: 'approve' | 'reject';
  zone?: unknown;
}

export interface AgentResumePayload {
  decisions: AgentResumeDecision[];
}

export interface ChatMessageRequest {
  message: string;
  session_id?: string;
  camera_id?: string;
  /** Structured resume (e.g. approve/reject config save). */
  resume?: AgentResumePayload;
}

/** `pending_approval` on agent chat responses (Electron approval card). */
export interface PendingApprovalPayload {
  summary?: {
    rule_id?: string;
    agent_rule_config?: Record<string, unknown> | null;
  };
}

/** Content block inside `message.content` (general chat v2). */
export interface GeneralChatContentBlock {
  type: string;
  /** General-chat often uses `value` for text blocks. */
  value?: string | null;
  /** Agent chat (`/api/v1/chat/message`) uses `text` for `type: "text"` blocks. */
  text?: string | null;
  name?: string | null;
  url?: string | null;
  caption?: string | null;
  columns?: unknown[];
  rows?: unknown[];
  title?: string | null;
  timestamp?: string | null;
  camera_id?: string | null;
  snapshot?: unknown;
  level?: string | null;
  language?: string | null;
  metadata?: unknown;
  chart_type?: string | null;
  labels?: unknown[] | null;
  values?: unknown[] | null;
}

export interface GeneralChatMessagePayload {
  id?: string;
  role?: string;
  content?: GeneralChatContentBlock[];
  evidence?: unknown[];
}

/**
 * `POST /api/v1/general-chat/message` — structured assistant message (same idea as Electron layout).
 * May also include legacy `reply` for older backends.
 */
export interface GeneralChatResponse {
  schema_version?: string;
  message?: GeneralChatMessagePayload;
  session_id?: string;
  status?: string;
  /** Legacy flat reply (optional). */
  reply?: string;
  action?: string;
  data?: unknown;
}

/**
 * `POST /api/v1/chat/message` — Vision agent chat (non-stream). Assistant text uses the same
 * `message.content[]` shape as general chat; extra fields support zone/HITL/flow UI (Electron parity).
 */
export interface AgentChatMessageResponse {
  message?: GeneralChatMessagePayload;
  session_id?: string;
  status?: string | null;
  camera_id?: string | null;
  zone_required?: boolean;
  awaiting_zone_input?: boolean;
  frame_snapshot_url?: string | null;
  zone_type?: string | null;
  flow_diagram_data?: Record<string, unknown> | null;
  pending_approval?: PendingApprovalPayload | null;
  pending_zone_input?: unknown;
  reply?: string;
}

/** @deprecated Prefer {@link GeneralChatResponse} */
export interface ChatMessageResponseV2 {
  reply: string;
  session_id?: string;
  action?: string;
  data?: unknown;
}

/** @deprecated Use {@link GeneralChatResponse} */
export type ChatMessageResponse = ChatMessageResponseV2;

/** Extract user-visible string from one content block (general `value` vs agent `text`). */
export function textFromContentBlock(block: GeneralChatContentBlock | Record<string, unknown>): string {
  const b = block as GeneralChatContentBlock & {text?: string | null; value?: string | null};
  if (typeof b.text === 'string' && b.text.trim()) {
    return b.text;
  }
  if (typeof b.value === 'string' && b.value.trim()) {
    return b.value;
  }
  return '';
}

/**
 * Plain text / markdown for the chat bubble from a general-chat or agent-chat JSON body.
 * Prefers `reply` if present; otherwise concatenates `message.content[]` using
 * {@link textFromContentBlock} (supports both `value` and `text`).
 */
export function assistantTextFromGeneralResponse(
  res: GeneralChatResponse | AgentChatMessageResponse | Record<string, unknown>,
): string {
  const r = res as GeneralChatResponse;
  if (typeof r.reply === 'string' && r.reply.length > 0) {
    return r.reply;
  }
  const blocks = r.message?.content;
  if (!Array.isArray(blocks)) {
    return '';
  }
  const parts: string[] = [];
  for (const block of blocks) {
    if (!block || typeof block !== 'object') {
      continue;
    }
    const piece = textFromContentBlock(block as GeneralChatContentBlock);
    if (piece.trim()) {
      parts.push(piece);
    }
  }
  return parts.join('\n\n');
}

/**
 * When the backend returns `message.content[]` and/or `message.evidence`, use structured bubble rendering
 * (same as `layout/chatbot-attachments.js`). Otherwise omit so the UI falls back to markdown on `reply` / flattened text.
 */
export function structuredAssistantMessage(
  res: GeneralChatResponse | AgentChatMessageResponse | Record<string, unknown>,
): {
  contentBlocks: GeneralChatContentBlock[] | undefined;
  evidence: unknown[] | undefined;
} {
  const msg = (res as GeneralChatResponse).message;
  if (!msg) {
    return {contentBlocks: undefined, evidence: undefined};
  }
  const blocks = msg.content;
  const blocksArr = Array.isArray(blocks) ? blocks : undefined;
  const ev = msg.evidence;
  const hasEvidence = Array.isArray(ev) && ev.length > 0;
  const hasBlocks = Array.isArray(blocksArr) && blocksArr.length > 0;
  if (!hasBlocks && !hasEvidence) {
    return {contentBlocks: undefined, evidence: undefined};
  }
  return {
    contentBlocks: hasBlocks ? blocksArr! : [],
    evidence: hasEvidence ? ev : undefined,
  };
}

export const chatApi = {
  /** Vision agent chat — `POST /api/v1/chat/message` (non-stream). */
  sendAgent: (body: ChatMessageRequest) =>
    apiFetch<AgentChatMessageResponse>('/api/v1/chat/message', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  /** General assistant (Ask mode) — `POST /api/v1/general-chat/message`. */
  sendGeneral: (body: ChatMessageRequest) =>
    apiFetch<GeneralChatResponse>('/api/v1/general-chat/message', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

// ─────────────────────────────────────────────────────────────────────────────
// ── WebSocket notification client ─────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

export interface WsNotification {
  type: string;
  event_id?: string;
  camera_name?: string;
  event_type?: string;
  severity?: string;
  message?: string;
  timestamp?: string;
}

export type WsListener = (n: WsNotification) => void;

class NotificationSocket {
  private ws: WebSocket | null = null;
  private listeners = new Set<WsListener>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = false;

  connect(token: string) {
    this.shouldReconnect = true;
    this._open(token);
  }

  private _open(token: string) {
    const url = `${BASE_URL.replace(/^http/, 'ws')}/api/v1/notifications/ws?token=${token}`;
    this.ws = new WebSocket(url);

    this.ws.onmessage = (e) => {
      try {
        const data: WsNotification = JSON.parse(e.data);
        this.listeners.forEach(l => l(data));
      } catch {}
    };

    this.ws.onclose = () => {
      if (this.shouldReconnect) {
        this.reconnectTimer = setTimeout(() => this._open(token), 4000);
      }
    };

    this.ws.onerror = () => { this.ws?.close(); };
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {clearTimeout(this.reconnectTimer);}
    this.ws?.close();
    this.ws = null;
  }

  // Use arrow functions so `this` is always bound to the instance,
  // even if someone calls these methods without preserving context.
  addListener = (fn: WsListener) => { this.listeners.add(fn); };
  removeListener = (fn: WsListener) => { this.listeners.delete(fn); };
}

export const notificationSocket = new NotificationSocket();
