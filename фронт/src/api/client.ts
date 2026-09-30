// API клиент для взаимодействия фронтенда с FastAPI бэкендом LeadHunter

const getApiBase = () => {
  if (typeof window !== 'undefined') {
    // В режиме разработки с Vite proxy
    return '/api';
  }
  return 'http://127.0.0.1:8000/api';
};

const getWsBase = () => {
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Если порт 5173 (Vite), идем через прокси ws
    return `${protocol}//${window.location.host}/ws`;
  }
  return 'ws://127.0.0.1:8000/ws';
};

export interface StartSearchParams {
  niche: string;
  city: string;
  source: 'yandex' | '2gis' | 'all';
  limit: number;
}

export interface StartSearchResponse {
  campaign_id: number;
  task_id: string;
  status: string;
  message: string;
}

export interface BackendLead {
  id: number;
  campaign_id: number;
  name: string;
  category?: string;
  address?: string;
  rating: number;
  reviews_count: number;
  primary_phone?: string;
  all_phones: string[];
  email?: string;
  all_emails: string[];
  telegram?: string;
  socials: Array<{ url: string }>;
  website?: string;
  final_url?: string;
  card_url?: string;
  source: 'yandex' | '2gis';
  status_badge: string;
  lead_score: number;
  has_ssl: boolean;
  is_adaptive: boolean;
  has_analytics: boolean;
  detected_cms?: string;
  last_updated_year?: number;
  pitch?: {
    pain?: string;
    solution?: string;
    opening_phrase?: string;
    full_text?: string;
  };
}

export interface BackendReport {
  id: number;
  created_at: string;
  finished_at: string | null;
  niche: string;
  city: string;
  source: string;
  requested_limit: number;
  found_count: number;
  status: string;
  summary: {
    no_site: number;
    no_ssl: number;
    not_responsive: number;
    no_analytics: number;
  };
}

export const api = {
  // Запуск сбора
  async startSearch(params: StartSearchParams): Promise<StartSearchResponse> {
    const res = await fetch(`${getApiBase()}/search/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Не удалось запустить сбор');
    }
    return res.json();
  },

  // Остановка сбора
  async stopSearch(campaignId: number): Promise<void> {
    await fetch(`${getApiBase()}/search/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_id: campaignId }),
    });
  },

  // Сигнал о решении капчи
  async resolveCaptcha(campaignId: number): Promise<void> {
    await fetch(`${getApiBase()}/search/captcha/resolved`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_id: campaignId }),
    });
  },

  // Получение городов
  async getCities(): Promise<string[]> {
    try {
      const res = await fetch(`${getApiBase()}/geo/cities`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Failed to fetch cities from API', e);
    }
    return ['Казань', 'Москва', 'Санкт-Петербург', 'Екатеринбург', 'Новосибирск'];
  },

  // Вкладка Отчеты: список
  async getReports(): Promise<BackendReport[]> {
    const res = await fetch(`${getApiBase()}/reports`);
    if (!res.ok) throw new Error('Ошибка получения отчетов');
    return res.json();
  },

  // Детали отчета
  async getReportDetail(campaignId: number): Promise<{ campaign: BackendReport; leads: BackendLead[] }> {
    const res = await fetch(`${getApiBase()}/reports/${campaignId}`);
    if (!res.ok) throw new Error('Ошибка получения деталей отчета');
    return res.json();
  },

  // Удаление отчета
  async deleteReport(campaignId: number): Promise<void> {
    await fetch(`${getApiBase()}/reports/${campaignId}`, {
      method: 'DELETE',
    });
  },

  // URL для скачивания Excel
  getExportExcelUrl(campaignId: number): string {
    return `${getApiBase()}/export/excel?campaign_id=${campaignId}`;
  },

  // Подключение к WebSocket
  connectWebSocket(
    campaignId: number,
    handlers: {
      onProgress?: (found: number, limit: number, percent: number) => void;
      onAuditStatus?: (domain: string, step: string, message: string) => void;
      onNewLead?: (lead: BackendLead) => void;
      onCaptchaRequired?: (service: string, message: string, hint: string) => void;
      onCompleted?: (total: number) => void;
      onStopped?: () => void;
      onError?: (error: string) => void;
    }
  ) {
    const wsUrl = `${getWsBase()}/${campaignId}`;
    let socket: WebSocket | null = null;
    let isClosedExplicitly = false;

    try {
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log(`[WS] Connected to campaign ${campaignId}`);
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          switch (msg.type) {
            case 'PROGRESS':
              handlers.onProgress?.(msg.data.found, msg.data.limit, msg.data.percent);
              break;
            case 'AUDIT_STATUS':
              handlers.onAuditStatus?.(msg.data.domain, msg.data.step, msg.data.message);
              break;
            case 'NEW_LEAD':
              handlers.onNewLead?.(msg.data);
              break;
            case 'CAPTCHA_REQUIRED':
              handlers.onCaptchaRequired?.(msg.data.service, msg.data.message, msg.data.hint);
              break;
            case 'COMPLETED':
              handlers.onCompleted?.(msg.data.total_found);
              break;
            case 'STOPPED':
              handlers.onStopped?.();
              break;
            case 'ERROR':
              handlers.onError?.(msg.data.error || 'Ошибка сбора');
              break;
          }
        } catch (e) {
          console.error('[WS] Parse error', e);
        }
      };

      socket.onerror = (e) => {
        console.warn('[WS] Error event', e);
      };

      socket.onclose = () => {
        if (!isClosedExplicitly) {
          console.log(`[WS] Disconnected from campaign ${campaignId}`);
        }
      };
    } catch (err) {
      console.error('[WS] Connection failed', err);
    }

    return {
      close() {
        isClosedExplicitly = true;
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.close();
        }
      }
    };
  },

  // FL.ru Заказы
  async getFlOrders(params?: {
    category_id?: string;
    min_price?: number;
    is_favorite?: boolean;
    is_hidden?: boolean;
    search?: string;
    page?: number;
    page_size?: number;
  }): Promise<{ items: BackendFLOrder[]; total: number; page: number; page_size: number }> {
    const q = new URLSearchParams();
    if (params?.category_id) q.set('category_id', params.category_id);
    if (params?.min_price) q.set('min_price', String(params.min_price));
    if (params?.is_favorite !== undefined) q.set('is_favorite', String(params.is_favorite));
    if (params?.is_hidden !== undefined) q.set('is_hidden', String(params.is_hidden));
    if (params?.search) q.set('search', params.search);
    if (params?.page) q.set('page', String(params.page));
    if (params?.page_size) q.set('page_size', String(params.page_size));

    const res = await fetch(`${getApiBase()}/fl/orders?${q.toString()}`);
    if (!res.ok) throw new Error('Ошибка получения заказов FL');
    return res.json();
  },

  async updateFlInteraction(orderId: number, data: { is_favorite?: boolean; is_hidden?: boolean; is_read?: boolean }): Promise<any> {
    const res = await fetch(`${getApiBase()}/fl/orders/${orderId}/interaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Ошибка обновления статуса заказа');
    return res.json();
  },

  async getFlCategories(): Promise<FLCategory[]> {
    const res = await fetch(`${getApiBase()}/fl/categories`);
    if (!res.ok) return [];
    return res.json();
  },

  async triggerFlPoll(): Promise<void> {
    await fetch(`${getApiBase()}/fl/poll`, { method: 'POST' });
  },

  async getFlWorkerStatus(): Promise<{
    is_running: boolean;
    poll_interval_min: number;
    poll_interval_max: number;
    next_poll_in: number;
    last_poll_at: string | null;
  }> {
    const res = await fetch(`${getApiBase()}/fl/worker/status`);
    if (!res.ok) return { is_running: true, poll_interval_min: 15, poll_interval_max: 20, next_poll_in: 18, last_poll_at: null };
    return res.json();
  },

  // Глобальный WebSocket для заказов FL
  connectGlobalWebSocket(handlers: {
    onNewFlOrder?: (order: BackendFLOrder) => void;
    onFlOrderUpdated?: (data: any) => void;
    onFlPollTick?: (data: { status: string; next_poll_in: number; last_poll_at: string | null }) => void;
  }) {
    const wsUrl = `${getWsBase()}/events`;
    let socket: WebSocket | null = null;
    let isClosed = false;

    try {
      socket = new WebSocket(wsUrl);
      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'NEW_FL_ORDER' && msg.data) {
            handlers.onNewFlOrder?.(msg.data);
          } else if (msg.type === 'FL_ORDER_INTERACTION_UPDATED' && msg.data) {
            handlers.onFlOrderUpdated?.(msg.data);
          } else if (msg.type === 'FL_POLL_TICK' && msg.data) {
            handlers.onFlPollTick?.(msg.data);
          }
        } catch (e) {
          console.error('[WS Global] Parse error', e);
        }
      };
      socket.onclose = () => {
        if (!isClosed) {
          setTimeout(() => {
            if (!isClosed) api.connectGlobalWebSocket(handlers);
          }, 3000);
        }
      };
    } catch (e) {
      console.error('[WS Global] Connection failed', e);
    }

    return {
      close() {
        isClosed = true;
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.close();
        }
      }
    };
  }
};

export interface BackendFLOrder {
  id: number;
  title: string;
  description: string;
  price_raw: string;
  price_rub: number | null;
  is_negotiable: boolean;
  category_id?: string;
  category_name?: string;
  url: string;
  is_pro_only: boolean;
  is_urgent: boolean;
  published_at?: string;
  created_at?: string;
  is_favorite: boolean;
  is_hidden: boolean;
  is_read: boolean;
}

export interface FLCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
}
