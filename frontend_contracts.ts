/**
 * TypeScript интерфейсы для интеграции фронтенда с LeadHunter Backend API
 * Скопируйте этот файл в ваш фронтенд проект (например, в src/types/api.ts)
 */

export type SourceType = 'yandex' | '2gis' | 'all';

export type StatusBadge = 
  | 'NO_SSL'           // Красный бейдж: Нет SSL сертификата
  | 'NOT_RESPONSIVE'   // Оранжевый бейдж: Не оптимизирован под смартфоны
  | 'NO_ANALYTICS'     // Желтый бейдж: Нет Яндекс.Метрики / Google Analytics
  | 'HTTPS_OK'         // Зеленый бейдж: Технически всё в порядке
  | 'NO_WEBSITE'       // Серый/Красный бейдж: Сайта нет совсем
  | 'SITE_DOWN';       // Сайт недоступен / ошибка соединения

export type CampaignStatus = 
  | 'PENDING'
  | 'RUNNING'
  | 'PAUSED_CAPTCHA'
  | 'COMPLETED'
  | 'STOPPED'
  | 'FAILED';

// Скрипт холодного звонка и оффер
export interface PitchDetail {
  pain: string | null;           // Боль клиента (почему теряет заявки)
  solution: string | null;       // Предлагаемое решение
  opening_phrase: string | null; // Первая фраза менеджера для звонка
  full_text: string | null;      // Полный текст скрипта
}

// Карточка лида (строка интерактивной таблицы)
export interface LeadItem {
  id: number;
  campaign_id: number;
  name: string;
  category: string | null;
  address: string | null;
  rating: number;
  reviews_count: number;
  
  // Контакты
  primary_phone: string | null;
  all_phones: string[];
  email: string | null;
  all_emails: string[];
  telegram: string | null;
  socials: Array<{ url: string }>;
  
  // Ссылки
  website: string | null;
  final_url: string | null;
  card_url: string | null;
  source: 'yandex' | '2gis';
  
  // Статусы и оценка
  status_badge: StatusBadge;
  lead_score: number; // от 0 до 100
  
  // Флаги аудита
  has_ssl: boolean;
  is_adaptive: boolean;
  has_analytics: boolean;
  detected_cms: string | null;
  last_updated_year: number | null;
  
  // Оффер (может быть null, если не раскрыт)
  pitch?: PitchDetail | null;
}

// Запрос на запуск поиска (Главный экран)
export interface SearchStartRequest {
  niche: string;
  city: string;
  source?: SourceType; // по умолчанию "all"
  limit?: number;      // по умолчанию 50 (от 10 до 200)
}

export interface SearchStartResponse {
  campaign_id: number;
  task_id: string;
  status: string;
  message: string;
}

// Вкладка «Отчёты» (Сводка по кампании)
export interface ReportSummary {
  no_site: number;
  no_ssl: number;
  not_responsive: number;
  no_analytics: number;
}

export interface ReportListItem {
  id: number;
  created_at: string;
  finished_at: string | null;
  niche: string;
  city: string;
  source: SourceType;
  requested_limit: number;
  found_count: number;
  status: CampaignStatus;
  summary: ReportSummary;
}

export interface ReportDetailResponse {
  campaign: ReportListItem;
  leads: LeadItem[];
}

// WebSocket события (/ws/{campaign_id})
export type WSEvent =
  | {
      type: 'PROGRESS';
      data: {
        found: number;
        limit: number;
        percent: number;
      };
    }
  | {
      type: 'AUDIT_STATUS';
      data: {
        domain: string;
        step: string;
        message: string;
      };
    }
  | {
      type: 'NEW_LEAD';
      data: LeadItem;
    }
  | {
      type: 'CAPTCHA_REQUIRED';
      data: {
        service: 'yandex' | '2gis';
        message: string;
        hint: string;
      };
    }
  | {
      type: 'COMPLETED';
      data: {
        campaign_id: number;
        total_found: number;
        status: 'COMPLETED';
      };
    }
  | {
      type: 'STOPPED';
      data: {
        campaign_id: number;
        message: string;
      };
    }
  | {
      type: 'ERROR';
      data: {
        campaign_id: number;
        error: string;
      };
    };
