import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Square,
  Download,
  Phone,
  Send,
  ArrowRight,
  ChevronDown,
  LayoutGrid,
  FileText,
  Settings,
  Star,
  Search,
  Check,
  RefreshCw,
  AlertTriangle,
  Trash2,
  Briefcase,
  LogOut
} from 'lucide-react';
import type { Lead, SearchConfig } from '../types';
import { LeadDetailModal } from './LeadDetailModal';
import { FlOrdersView } from './FlOrdersView';
import { exportLeadsToExcel } from '../utils/exportExcel';
import { api, type BackendReport } from '../api/client';

interface AuditDashboardProps {
  config: SearchConfig;
  setConfig: React.Dispatch<React.SetStateAction<SearchConfig>>;
  leads: Lead[];
  onBackToSearch: () => void;
  isVisible: boolean;
  isAuditing?: boolean;
  onStartAudit?: () => void;
  onStopAudit?: () => void;
  progressPercent?: number;
  currentFound?: number;
  auditStatusMessage?: string;
  captchaRequired?: { service: string; message: string } | null;
  onResolveCaptcha?: () => void;
  onSelectHistoricalCampaign?: (campaignId: number) => void;
  initialTab?: 'grid' | 'fl' | 'docs' | 'settings';
}

export const AuditDashboard: React.FC<AuditDashboardProps> = ({
  config,
  setConfig,
  leads,
  onBackToSearch,
  isVisible,
  isAuditing = false,
  onStartAudit,
  onStopAudit,
  progressPercent = 0,
  currentFound = 0,
  auditStatusMessage = '',
  captchaRequired = null,
  onResolveCaptcha,
  onSelectHistoricalCampaign,
  initialTab = 'grid',
}) => {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [leadLimit, setLeadLimit] = useState(config.limit || 50);
  const [activeTab, setActiveTab] = useState<'grid' | 'fl' | 'docs' | 'settings'>(initialTab);
  const [onlyWithTelegram, setOnlyWithTelegram] = useState<boolean>(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Filter dropdown states
  const [nicheOpen, setNicheOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [mapsOpen, setMapsOpen] = useState(false);
  const filterBarRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterBarRef.current && !filterBarRef.current.contains(event.target as Node)) {
        setNicheOpen(false);
        setCityOpen(false);
        setMapsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setNicheOpen(false);
        setCityOpen(false);
        setMapsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Reports tab state
  const [reports, setReports] = useState<BackendReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);

  const niches = ['Стоматологии', 'Автосервисы', 'Салоны красоты', 'Юридические услуги', 'Недвижимость', 'Клининг'];
  const cities = ['Казань', 'Москва', 'Санкт-Петербург', 'Екатеринбург', 'Новосибирск', 'Нижний Новгород'];
  const mapSources = ['Yandex Maps', '2GIS', 'Yandex Maps, 2GIS'];

  // Загрузка отчетов при открытии вкладки 'docs'
  useEffect(() => {
    if (activeTab === 'docs') {
      loadReports();
    }
  }, [activeTab]);

  const loadReports = async () => {
    setLoadingReports(true);
    try {
      const data = await api.getReports();
      setReports(data);
    } catch (e) {
      console.error('Failed to load reports', e);
    } finally {
      setLoadingReports(false);
    }
  };

  const handleDeleteReport = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Удалить отчет #${id}?`)) {
      try {
        await api.deleteReport(id);
        setReports((prev) => prev.filter((r) => r.id !== id));
      } catch (err) {
        alert('Ошибка при удалении отчета');
      }
    }
  };

  const handleExport = () => {
    if (config.campaignId) {
      // Прямой экспорт отформатированного файла через бэкенд
      window.open(api.getExportExcelUrl(config.campaignId), '_blank');
    } else {
      // Локальный экспорт текущего состояния таблицы
      exportLeadsToExcel(leads, `LeadGen_${config.niche}_${config.city}.xlsx`);
    }
  };

  const handleCopyPhone = (phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(phone);
    setCopyFeedback(phone);
    setTimeout(() => setCopyFeedback(null), 1500);
  };

  return (
    <div
      className={`relative z-20 h-screen flex flex-col bg-black/95 text-white transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isVisible
          ? 'translate-y-0 opacity-100'
          : '-translate-y-full opacity-0 pointer-events-none'
      }`}
    >
      {/* 1. Header Bar */}
      <header className="h-14 border-b border-white/10 px-4 sm:px-6 flex items-center justify-between bg-black/80 backdrop-blur-md z-30 select-none">
        <div className="flex items-center gap-3">
          {/* Mini ASCII Cat Logo */}
          <button
            onClick={onBackToSearch}
            title="Вернуться к поиску"
            className="flex items-center gap-2.5 group cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-white/10 flex items-center justify-center p-0.5 group-hover:border-white/30 transition-colors">
              <img
                src="/mini-cat.png"
                alt="Mini Cat Logo"
                className="w-full h-full object-contain filter invert"
              />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-[15px] tracking-tight text-neutral-100">
                LeadGen & Audit Pro
              </span>
              <span className="hidden md:inline font-mono text-xs text-neutral-500">
                // Niche: {config.niche} | {config.city} | {config.maps}
              </span>
            </div>
          </button>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onBackToSearch}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Поиск</span>
          </button>

          <a
            href="/logout"
            title="Выйти из системы"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Выйти</span>
          </a>
        </div>
      </header>

      {/* Main Layout Body */}
      <div className="flex-1 flex min-h-0">
        {/* 2. Left Icon Sidebar */}
        <aside className="w-14 sm:w-16 border-r border-white/10 flex flex-col items-center justify-between py-5 bg-black/60 backdrop-blur-md select-none shrink-0 z-30">
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={() => setActiveTab('grid')}
              className={`p-2.5 rounded-xl transition-all relative ${
                activeTab === 'grid'
                  ? 'text-white bg-white/10'
                  : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'
              }`}
              title="Дашборд лидов"
            >
              {activeTab === 'grid' && (
                <span className="absolute -left-3 sm:-left-3.5 top-1/2 -translate-y-1/2 w-1 h-5 bg-white rounded-r-full" />
              )}
              <LayoutGrid className="w-5 h-5" />
            </button>

            <button
              onClick={() => setActiveTab('fl')}
              className={`p-2.5 rounded-xl transition-all relative ${
                activeTab === 'fl'
                  ? 'text-white bg-white/10'
                  : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'
              }`}
              title="Биржа FL.ru (Заказы)"
            >
              {activeTab === 'fl' && (
                <span className="absolute -left-3 sm:-left-3.5 top-1/2 -translate-y-1/2 w-1 h-5 bg-white rounded-r-full" />
              )}
              <Briefcase className="w-5 h-5" />
            </button>

            <button
              onClick={() => setActiveTab('docs')}
              className={`p-2.5 rounded-xl transition-all relative ${
                activeTab === 'docs'
                  ? 'text-white bg-white/10'
                  : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'
              }`}
              title="Отчеты (История поисков)"
            >
              {activeTab === 'docs' && (
                <span className="absolute -left-3 sm:-left-3.5 top-1/2 -translate-y-1/2 w-1 h-5 bg-white rounded-r-full" />
              )}
              <FileText className="w-5 h-5" />
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`p-2.5 rounded-xl transition-all relative ${
                activeTab === 'settings'
                  ? 'text-white bg-white/10'
                  : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'
              }`}
              title="Настройки"
            >
              {activeTab === 'settings' && (
                <span className="absolute -left-3 sm:-left-3.5 top-1/2 -translate-y-1/2 w-1 h-5 bg-white rounded-r-full" />
              )}
              <Settings className="w-5 h-5" />
            </button>
          </div>

          {/* User Profile Avatar at Bottom */}
          <div className="relative group cursor-pointer" title="Профиль">
            <div className="w-9 h-9 rounded-full overflow-hidden border border-white/20 p-0.5 hover:border-white/50 transition-colors">
              <img
                src="/avatar.png"
                alt="User Avatar"
                className="w-full h-full object-cover rounded-full"
              />
            </div>
          </div>
        </aside>

        {/* 3. Center Dashboard Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8 max-w-[1240px] z-10">
          {/* Captcha Alert Banner */}
          {captchaRequired && (
            <div className="mb-4 bg-amber-500/15 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between gap-4 animate-pulse shadow-lg shadow-amber-500/5">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <div className="font-semibold text-sm text-amber-300">
                    {captchaRequired.message || 'Яндекс запросил капчу'}
                  </div>
                  <div className="text-xs text-amber-400/80">
                    Пройдите проверку в открывшемся окне браузера и нажмите кнопку справа:
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onResolveCaptcha}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-black font-semibold text-xs rounded-xl transition-all shadow-md active:scale-95 shrink-0"
              >
                Я прошел капчу
              </button>
            </div>
          )}

          {/* TAB 1: GRID VIEW (LEADS TABLE) */}
          {activeTab === 'grid' && (
            <>
              {/* Top Filter Strip */}
              <div ref={filterBarRef} className="relative z-30 bg-[#0e0e12]/80 backdrop-blur-md border border-white/10 rounded-2xl p-3 sm:p-4 mb-5 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  {/* Dropdown Filters */}
                  <div className="flex flex-wrap items-center gap-3 sm:gap-4 flex-1">
                    {/* NICHE Dropdown */}
                    <div className="relative">
                      <span className="block text-[10px] font-mono uppercase text-neutral-400 mb-1 tracking-wider">
                        NICHE
                      </span>
                      <button
                        type="button"
                        onClick={() => setNicheOpen(!nicheOpen)}
                        className="flex items-center justify-between gap-3 px-3.5 py-2 bg-[#141418] hover:bg-[#1a1a20] border border-white/10 rounded-xl text-sm font-medium text-neutral-200 min-w-[130px] transition-all cursor-pointer"
                      >
                        <span>{config.niche}</span>
                        <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
                      </button>
                      {nicheOpen && (
                        <div className="absolute left-0 top-full mt-1.5 w-44 bg-[#141418] border border-white/15 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto">
                          {niches.map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => {
                                setConfig((prev) => ({ ...prev, niche: n }));
                                setNicheOpen(false);
                              }}
                              className="w-full text-left px-3.5 py-2 text-xs text-neutral-300 hover:bg-white/10 hover:text-white transition-colors"
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* CITY Dropdown */}
                    <div className="relative">
                      <span className="block text-[10px] font-mono uppercase text-neutral-400 mb-1 tracking-wider">
                        CITY
                      </span>
                      <button
                        type="button"
                        onClick={() => setCityOpen(!cityOpen)}
                        className="flex items-center justify-between gap-3 px-3.5 py-2 bg-[#141418] hover:bg-[#1a1a20] border border-white/10 rounded-xl text-sm font-medium text-neutral-200 min-w-[120px] transition-all cursor-pointer"
                      >
                        <span>{config.city}</span>
                        <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
                      </button>
                      {cityOpen && (
                        <div className="absolute left-0 top-full mt-1.5 w-40 bg-[#141418] border border-white/15 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto">
                          {cities.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => {
                                setConfig((prev) => ({ ...prev, city: c }));
                                setCityOpen(false);
                              }}
                              className="w-full text-left px-3.5 py-2 text-xs text-neutral-300 hover:bg-white/10 hover:text-white transition-colors"
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* MAPS Dropdown */}
                    <div className="relative">
                      <span className="block text-[10px] font-mono uppercase text-neutral-400 mb-1 tracking-wider">
                        MAPS
                      </span>
                      <button
                        type="button"
                        onClick={() => setMapsOpen(!mapsOpen)}
                        className="flex items-center justify-between gap-3 px-3.5 py-2 bg-[#141418] hover:bg-[#1a1a20] border border-white/10 rounded-xl text-sm font-medium text-neutral-200 min-w-[140px] transition-all cursor-pointer"
                      >
                        <span>{config.maps}</span>
                        <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
                      </button>
                      {mapsOpen && (
                        <div className="absolute left-0 top-full mt-1.5 w-48 bg-[#141418] border border-white/15 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto">
                          {mapSources.map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => {
                                setConfig((prev) => ({ ...prev, maps: m }));
                                setMapsOpen(false);
                              }}
                              className="w-full text-left px-3.5 py-2 text-xs text-neutral-300 hover:bg-white/10 hover:text-white transition-colors"
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* LEAD LIMIT Slider */}
                    <div className="min-w-[130px]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono uppercase text-neutral-400 tracking-wider">
                          LEAD LIMIT
                        </span>
                        <span className="text-xs font-mono font-medium text-neutral-200">
                          {leadLimit}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="100"
                        step="5"
                        value={leadLimit}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setLeadLimit(val);
                          setConfig((prev) => ({ ...prev, limit: val }));
                        }}
                        className="w-full cursor-pointer accent-white"
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-3">
                    {isAuditing ? (
                      <button
                        type="button"
                        onClick={onStopAudit}
                        className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-semibold text-xs tracking-wide rounded-xl transition-all cursor-pointer"
                      >
                        <Square className="w-3.5 h-3.5 fill-white stroke-none" />
                        <span>Остановить</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onStartAudit}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-neutral-200 active:scale-95 text-black font-semibold text-xs tracking-wide rounded-xl transition-all shadow-[0_2px_15px_rgba(255,255,255,0.15)] cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-black stroke-none" />
                        <span>Start Audit</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleExport}
                      className="flex items-center gap-2 px-5 py-2.5 bg-[#141418] hover:bg-[#1f1f26] active:scale-95 text-neutral-200 hover:text-white border border-white/10 rounded-xl text-xs font-medium tracking-wide transition-all cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export to Excel</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Progress Bar & Status Radar Strip */}
              <div className="mb-4">
                <div className="flex flex-wrap items-center justify-between text-xs font-mono text-neutral-400 mb-1.5 gap-2">
                  <div className="flex items-center gap-2">
                    <span>
                      Found: <strong className="text-neutral-200">{currentFound || leads.length}</strong> / {leadLimit} leads
                    </span>
                    {auditStatusMessage && (
                      <span className="text-neutral-500 truncate max-w-[300px]">
                        | {auditStatusMessage}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Telegram Filter Toggle */}
                    <button
                      type="button"
                      onClick={() => setOnlyWithTelegram(!onlyWithTelegram)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-mono transition-all cursor-pointer ${
                        onlyWithTelegram
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-semibold shadow-sm shadow-emerald-500/10'
                          : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white hover:bg-white/10'
                      }`}
                      title="Показывать только компании с найденным контактом Telegram"
                    >
                      <Send className={`w-3 h-3 ${onlyWithTelegram ? 'text-emerald-400' : 'text-neutral-400'}`} />
                      <span>{onlyWithTelegram ? 'Только с Telegram' : 'Все компании'}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/50 border border-white/10 text-neutral-300">
                        {leads.filter((l) => Boolean(l.telegram && l.telegram.trim())).length}/{leads.length}
                      </span>
                    </button>

                    <span>{progressPercent}%</span>
                  </div>
                </div>
                <div className="w-full h-1 bg-neutral-900 rounded-full overflow-hidden border border-white/5">
                  <div
                    className="h-full bg-neutral-300 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Leads Table */}
              <div className="bg-[#0b0b0e]/90 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-[11px] font-mono uppercase text-neutral-400 tracking-wider">
                        <th className="py-3.5 px-4 w-12 text-center">#</th>
                        <th className="py-3.5 px-4">COMPANY NAME</th>
                        <th className="py-3.5 px-4">CONTACTS</th>
                        <th className="py-3.5 px-4">TYPE</th>
                        <th className="py-3.5 px-4 w-10 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {(() => {
                        const displayedLeads = onlyWithTelegram
                          ? leads.filter((l) => Boolean(l.telegram && l.telegram.trim()))
                          : leads;

                        if (displayedLeads.length === 0) {
                          return (
                            <tr>
                              <td colSpan={5} className="py-12 text-center text-neutral-500 font-mono text-xs">
                                {isAuditing ? (
                                  <div className="flex flex-col items-center gap-2">
                                    <RefreshCw className="w-5 h-5 animate-spin text-neutral-400" />
                                    <span>Поиск и аудит организаций в процессе...</span>
                                  </div>
                                ) : onlyWithTelegram ? (
                                  'Нет организаций с прямым Telegram контактом. Переключитесь на «Все компании».'
                                ) : (
                                  'Нет собранных лидов. Нажмите «Start Audit» для запуска сбора.'
                                )}
                              </td>
                            </tr>
                          );
                        }

                        return displayedLeads.slice(0, leadLimit).map((lead, idx) => (
                          <tr
                            key={lead.id || idx}
                            onClick={() => setSelectedLead(lead)}
                            className="group hover:bg-white/[0.04] transition-colors cursor-pointer"
                          >
                            {/* # Column */}
                            <td className="py-3.5 px-4 text-center font-mono text-neutral-400">
                              {idx + 1}
                            </td>

                            {/* Company Name & Rating & Category */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div>
                                  <div className="font-semibold text-sm text-neutral-100 group-hover:text-white transition-colors">
                                    {lead.name}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {/* Stars */}
                                    <div className="flex items-center text-white/90">
                                      {[...Array(5)].map((_, i) => (
                                        <Star
                                          key={i}
                                          className={`w-3 h-3 ${
                                            i < Math.round(lead.rating)
                                              ? 'fill-white text-white'
                                              : 'fill-transparent text-neutral-600'
                                          }`}
                                        />
                                      ))}
                                    </div>
                                    {/* Category Badge */}
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-neutral-400 font-mono">
                                      {lead.category}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Contacts (Phone + Telegram) */}
                            <td className="py-3.5 px-4">
                              <div className="space-y-1">
                                <button
                                  type="button"
                                  onClick={(e) => handleCopyPhone(lead.phone, e)}
                                  className="flex items-center gap-2 text-neutral-300 hover:text-white font-mono text-xs transition-colors group/phone"
                                  title="Нажмите, чтобы скопировать"
                                >
                                  <Phone className="w-3.5 h-3.5 text-neutral-400 group-hover/phone:text-white" />
                                  <span>{lead.phone}</span>
                                  {copyFeedback === lead.phone && (
                                    <span className="text-[10px] text-emerald-400 font-sans ml-1 flex items-center gap-0.5">
                                      <Check className="w-3 h-3" /> скопировано
                                    </span>
                                  )}
                                </button>
                                {lead.telegram ? (
                                  <a
                                    href={`https://t.me/${lead.telegram.replace('@', '')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex items-center gap-2 text-neutral-400 hover:text-neutral-200 font-mono text-xs transition-colors"
                                  >
                                    <Send className="w-3.5 h-3.5 text-neutral-500" />
                                    <span>{lead.telegram}</span>
                                  </a>
                                ) : lead.email ? (
                                  <span className="text-[11px] text-neutral-500 font-mono flex items-center gap-1.5">
                                    <span>✉️</span>
                                    <span>{lead.email}</span>
                                  </span>
                                ) : null}
                              </div>
                            </td>

                            {/* TYPE (Status Pill) */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2">
                                <span className={`inline-block px-3 py-1 rounded-full text-[11px] font-mono border transition-colors ${
                                  lead.status === 'No SSL'
                                    ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                                    : lead.status === 'Not Responsive'
                                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                                    : lead.status === 'No Analytics'
                                    ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300'
                                    : lead.status === 'No Website'
                                    ? 'bg-neutral-800 border-neutral-700 text-neutral-400'
                                    : 'bg-[#141418] border-white/15 text-neutral-300'
                                }`}>
                                  {lead.status}
                                </span>
                                {lead.leadScore !== undefined && (
                                  <span className="text-[10px] font-mono text-neutral-500">
                                    {lead.leadScore}/100
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Action Arrow */}
                            <td className="py-3.5 px-4 text-right">
                              <ArrowRight className="w-4 h-4 text-neutral-600 group-hover:text-white group-hover:translate-x-1 transition-all inline-block" />
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* TAB: FL.RU ORDERS VIEW (БИРЖА ЗАКАЗОВ) */}
          {activeTab === 'fl' && <FlOrdersView />}

          {/* TAB 2: REPORTS VIEW (ВКЛАДКА ОТЧЁТЫ - ИСТОРИЯ ПОИСКОВ) */}
          {activeTab === 'docs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-white">История отчётов</h2>
                  <p className="text-xs text-neutral-400 mt-1">
                    Список всех когда-либо проведенных поисков с возможностью повторного просмотра лидов и выгрузки Excel.
                  </p>
                </div>
                <button
                  onClick={loadReports}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingReports ? 'animate-spin' : ''}`} />
                  <span>Обновить</span>
                </button>
              </div>

              {loadingReports ? (
                <div className="py-16 text-center text-neutral-500 font-mono text-xs">
                  Загрузка истории отчётов...
                </div>
              ) : reports.length === 0 ? (
                <div className="py-16 text-center text-neutral-500 font-mono text-xs bg-[#0b0b0e] border border-white/10 rounded-2xl">
                  Пока нет сохраненных отчетов. Запустите первый поиск на главной странице!
                </div>
              ) : (
                <div className="grid gap-3">
                  {reports.map((report) => (
                    <div
                      key={report.id}
                      className="bg-[#0e0e12]/80 border border-white/10 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 hover:border-white/20 transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-neutral-100">
                            {report.niche} — г. {report.city}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-neutral-300 font-mono">
                            {report.source}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                            report.status === 'COMPLETED'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            {report.status}
                          </span>
                        </div>
                        <div className="text-xs text-neutral-400 font-mono">
                          Дата: {new Date(report.created_at).toLocaleString('ru-RU')} | Найдено: {report.found_count} из {report.requested_limit}
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[10px] font-mono text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">
                            Без сайта: {report.summary?.no_site || 0}
                          </span>
                          <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                            Без SSL: {report.summary?.no_ssl || 0}
                          </span>
                          <span className="text-[10px] font-mono text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded">
                            Без Метрики: {report.summary?.no_analytics || 0}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (onSelectHistoricalCampaign) {
                              onSelectHistoricalCampaign(report.id);
                              setActiveTab('grid');
                            }
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black font-semibold text-xs rounded-xl hover:bg-neutral-200 transition-all"
                        >
                          <span>Открыть лиды</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => window.open(api.getExportExcelUrl(report.id), '_blank')}
                          title="Скачать Excel файл"
                          className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-neutral-300 hover:text-white transition-all"
                        >
                          <Download className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleDeleteReport(report.id, e)}
                          title="Удалить отчет"
                          className="p-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl text-rose-400 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="bg-[#0e0e12] border border-white/10 rounded-2xl p-6 space-y-4">
              <h2 className="text-xl font-bold text-white">Параметры системы</h2>
              <div className="space-y-2 text-xs text-neutral-300 font-mono">
                <div>• Сервер API: http://127.0.0.1:8000</div>
                <div>• WebSocket: ws://127.0.0.1:8000/ws</div>
                <div>• База данных: SQLite (leadhunter.db)</div>
                <div>• Движок аудита: HTTPX + Selectolax Parser</div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Lead Detail Modal */}
      <LeadDetailModal
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
      />
    </div>
  );
};
