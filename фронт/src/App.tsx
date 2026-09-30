import React, { useState, useEffect, useRef } from 'react';
import CursorRingField from './components/CursorRingField';
import { SearchHero } from './components/SearchHero';
import { AuditDashboard } from './components/AuditDashboard';
import type { SearchConfig, Lead } from './types';
import { api, type BackendLead } from './api/client';
import { mapBackendLeadToFrontend } from './utils/mapLead';

export const App: React.FC = () => {
  // Navigation / View State
  const [isDropping, setIsDropping] = useState<boolean>(false);
  const [showDashboard, setShowDashboard] = useState<boolean>(false);
  const [dashboardTab, setDashboardTab] = useState<'grid' | 'fl' | 'docs' | 'settings'>('grid');

  // Search Configuration State
  const [niche, setNiche] = useState<string>('Стоматологии');
  const [city, setCity] = useState<string>('Казань');
  const [config, setConfig] = useState<SearchConfig>({
    niche: 'Стоматологии',
    city: 'Казань',
    maps: 'Yandex Maps, 2GIS',
    limit: 50,
  });

  // Leads Data State
  const [leads, setLeads] = useState<Lead[]>([]);

  // Live WebSocket & Audit States
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [currentFound, setCurrentFound] = useState<number>(0);
  const [auditStatusMessage, setAuditStatusMessage] = useState<string>('');
  const [captchaRequired, setCaptchaRequired] = useState<{ service: string; message: string } | null>(null);

  const wsClientRef = useRef<{ close: () => void } | null>(null);

  // Очистка WebSocket при размонтировании
  useEffect(() => {
    return () => {
      if (wsClientRef.current) {
        wsClientRef.current.close();
      }
    };
  }, []);

  const getSourceFromConfig = (maps: string): 'yandex' | '2gis' | 'all' => {
    if (maps === '2GIS') return '2gis';
    if (maps === 'Yandex Maps') return 'yandex';
    return 'all';
  };

  // Запуск реального поиска через FastAPI бэкенд
  const triggerSearch = async (searchNiche: string, searchCity: string, searchLimit: number, mapsSource: string) => {
    // Закрываем предыдущий сокет если был
    if (wsClientRef.current) {
      wsClientRef.current.close();
      wsClientRef.current = null;
    }

    setIsAuditing(true);
    setProgressPercent(0);
    setCurrentFound(0);
    setAuditStatusMessage('Инициализация скрейпера...');
    setCaptchaRequired(null);
    setLeads([]);

    try {
      const source = getSourceFromConfig(mapsSource);
      const res = await api.startSearch({
        niche: searchNiche,
        city: searchCity,
        source: source,
        limit: searchLimit,
      });

      const campaignId = res.campaign_id;
      setConfig((prev) => ({
        ...prev,
        niche: searchNiche,
        city: searchCity,
        limit: searchLimit,
        campaignId: campaignId,
      }));

      // Подключаемся к WebSocket для стриминга прогресса и лидов
      const wsClient = api.connectWebSocket(campaignId, {
        onProgress: (found, _limit, percent) => {
          setCurrentFound(found);
          setProgressPercent(percent);
        },
        onAuditStatus: (_domain, _step, message) => {
          setAuditStatusMessage(message);
        },
        onNewLead: (bLead: BackendLead) => {
          const fLead = mapBackendLeadToFrontend(bLead);
          setLeads((prev) => {
            // Защита от дублей по id
            if (prev.some((x) => x.id === fLead.id)) return prev;
            return [fLead, ...prev];
          });
        },
        onCaptchaRequired: (service, message) => {
          setCaptchaRequired({ service, message });
        },
        onCompleted: (total) => {
          setIsAuditing(false);
          setAuditStatusMessage(`Сбор успешно завершен! Собрано: ${total}`);
          setProgressPercent(100);
        },
        onStopped: () => {
          setIsAuditing(false);
          setAuditStatusMessage('Сбор остановлен пользователем');
        },
        onError: (err) => {
          setIsAuditing(false);
          setAuditStatusMessage(`Ошибка: ${err}`);
        },
      });

      wsClientRef.current = wsClient;
    } catch (e: any) {
      setIsAuditing(false);
      setAuditStatusMessage(`Ошибка старта: ${e.message}`);
      alert(`Не удалось запустить сбор: ${e.message}\nУбедитесь, что бэкенд запущен на http://localhost:8000`);
    }
  };

  // Клик по кнопке Поиск на первом экране
  const handleSearch = () => {
    setDashboardTab('grid');
    // Плавная анимация перехода
    setIsDropping(true);
    setTimeout(() => {
      setShowDashboard(true);
    }, 280);

    triggerSearch(niche, city, config.limit, config.maps);
  };

  // Прямой переход к заказам биржи FL.ru с главного экрана
  const handleOpenFl = () => {
    setDashboardTab('fl');
    setIsDropping(true);
    setTimeout(() => {
      setShowDashboard(true);
    }, 280);
  };

  // Повторный запуск аудита из дашборда
  const handleStartAuditFromDashboard = () => {
    triggerSearch(config.niche, config.city, config.limit, config.maps);
  };

  // Остановка поиска
  const handleStopAudit = async () => {
    if (config.campaignId) {
      await api.stopSearch(config.campaignId);
    }
    setIsAuditing(false);
  };

  // Подтверждение прохождения капчи
  const handleResolveCaptcha = async () => {
    if (config.campaignId) {
      await api.resolveCaptcha(config.campaignId);
      setCaptchaRequired(null);
    }
  };

  // Открытие лидов из исторического отчета
  const handleSelectHistoricalCampaign = async (campaignId: number) => {
    if (wsClientRef.current) {
      wsClientRef.current.close();
      wsClientRef.current = null;
    }
    setIsAuditing(false);
    setCaptchaRequired(null);

    try {
      const data = await api.getReportDetail(campaignId);
      const mapped = data.leads.map((b) => mapBackendLeadToFrontend(b));
      setLeads(mapped);
      setConfig((prev) => ({
        ...prev,
        niche: data.campaign.niche,
        city: data.campaign.city,
        limit: data.campaign.requested_limit,
        campaignId: data.campaign.id,
      }));
      setCurrentFound(mapped.length);
      setProgressPercent(100);
      setAuditStatusMessage(`Загружен исторический отчет от ${new Date(data.campaign.created_at).toLocaleDateString()}`);
    } catch (e) {
      alert('Не удалось загрузить отчет');
    }
  };

  // Возврат на экран поиска
  const handleBackToSearch = () => {
    setShowDashboard(false);
    setTimeout(() => {
      setIsDropping(false);
    }, 250);
  };

  return (
    <div className="relative min-h-screen w-full bg-black text-white overflow-hidden selection:bg-white/20 selection:text-white">
      {/* Main Background — WebGL Ring Animation */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none" aria-hidden="true">
        <CursorRingField />
      </div>

      {/* Screen 1: Search & ASCII Cat Mascot */}
      <SearchHero
        niche={niche}
        setNiche={setNiche}
        city={city}
        setCity={setCity}
        onSearch={handleSearch}
        onOpenFl={handleOpenFl}
        isDropping={isDropping}
      />

      {/* Screen 2: LeadGen & Audit Pro Dashboard Panel */}
      <div
        className={`fixed inset-0 z-20 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          showDashboard
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0'
        }`}
      >
        <AuditDashboard
          config={config}
          setConfig={setConfig}
          leads={leads}
          onBackToSearch={handleBackToSearch}
          isVisible={showDashboard}
          isAuditing={isAuditing}
          onStartAudit={handleStartAuditFromDashboard}
          onStopAudit={handleStopAudit}
          progressPercent={progressPercent}
          currentFound={currentFound}
          auditStatusMessage={auditStatusMessage}
          captchaRequired={captchaRequired}
          onResolveCaptcha={handleResolveCaptcha}
          onSelectHistoricalCampaign={handleSelectHistoricalCampaign}
          initialTab={dashboardTab}
        />
      </div>
    </div>
  );
};

export default App;
