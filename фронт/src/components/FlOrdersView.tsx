import React, { useState, useEffect, useRef } from 'react';
import {
  Briefcase,
  Star,
  EyeOff,
  ExternalLink,
  Search,
  RefreshCw,
  Flame,
  Crown,
  Zap,
  Volume2,
  VolumeX,
  ShieldCheck
} from 'lucide-react';
import { api, type BackendFLOrder, type FLCategory } from '../api/client';

// Мягкий синтезированный звук уведомления через Web Audio API (без внешних mp3 файлов)
const playChime = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.36);
  } catch {
    // В некоторых браузерах AudioContext блокируется до первого жеста пользователя
  }
};

export const FlOrdersView: React.FC = () => {
  const [orders, setOrders] = useState<BackendFLOrder[]>([]);
  const [categories, setCategories] = useState<FLCategory[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [filterMode, setFilterMode] = useState<'all' | 'favorite' | 'hidden'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [minPrice, setMinPrice] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [stats, setStats] = useState<{ total: number; favorites: number }>({ total: 0, favorites: 0 });

  // Live-режим: тумблер, обратный отсчет (15-20с) и статус воркера
  const [liveEnabled, setLiveEnabled] = useState<boolean>(true);
  const [secondsUntilNextPoll, setSecondsUntilNextPoll] = useState<number>(18);
  const [workerStatus, setWorkerStatus] = useState<'idle' | 'polling'>('idle');
  const [lastPollTime, setLastPollTime] = useState<string>('');
  const [newLiveOrderIds, setNewLiveOrderIds] = useState<Set<number>>(new Set());
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Рефы для доступа к актуальному состоянию внутри WebSocket колбэков
  const liveEnabledRef = useRef(liveEnabled);
  liveEnabledRef.current = liveEnabled;
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  // Загрузка категорий и начального статуса воркера при монтировании
  useEffect(() => {
    api.getFlCategories().then(setCategories).catch(console.error);
    api.getFlWorkerStatus().then((st) => {
      if (st.next_poll_in) setSecondsUntilNextPoll(Math.round(st.next_poll_in));
      if (st.last_poll_at) setLastPollTime(new Date(st.last_poll_at).toLocaleTimeString('ru-RU'));
    }).catch(console.error);
  }, []);

  // Локальный таймер обратного отсчета для плавной анимации секунд до следующей проверки
  useEffect(() => {
    if (!liveEnabled) return;
    const interval = setInterval(() => {
      setSecondsUntilNextPoll((prev) => {
        if (prev <= 1) {
          return 18; // Сброс до получения тика от бэкенда
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [liveEnabled]);

  // Загрузка заказов при смене фильтров
  useEffect(() => {
    loadOrders();
  }, [selectedCat, filterMode, minPrice]);

  // Подписка на глобальный WebSocket для мгновенных Live-обновлений
  useEffect(() => {
    const ws = api.connectGlobalWebSocket({
      onNewFlOrder: (newOrder) => {
        if (!liveEnabledRef.current) return;
        setOrders((prev) => {
          if (prev.some((o) => o.id === newOrder.id)) return prev;
          return [newOrder, ...prev];
        });
        setNewLiveOrderIds((prev) => new Set(prev).add(newOrder.id));
        setStats((prev) => ({ ...prev, total: prev.total + 1 }));
        if (soundEnabledRef.current) {
          playChime();
        }
      },
      onFlPollTick: (tick) => {
        if (tick.status === 'polling') {
          setWorkerStatus('polling');
        } else {
          setWorkerStatus('idle');
          if (tick.next_poll_in) {
            setSecondsUntilNextPoll(Math.round(tick.next_poll_in));
          }
          if (tick.last_poll_at) {
            setLastPollTime(new Date(tick.last_poll_at).toLocaleTimeString('ru-RU'));
          }
        }
      },
      onFlOrderUpdated: (data) => {
        setOrders((prev) =>
          prev.map((o) => {
            if (o.id === data.order_id) {
              return {
                ...o,
                is_favorite: data.is_favorite !== undefined ? data.is_favorite : o.is_favorite,
                is_hidden: data.is_hidden !== undefined ? data.is_hidden : o.is_hidden,
                is_read: data.is_read !== undefined ? data.is_read : o.is_read,
              };
            }
            return o;
          })
        );
      },
    });

    return () => {
      ws.close();
    };
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await api.getFlOrders({
        category_id: selectedCat === 'all' ? undefined : selectedCat,
        is_favorite: filterMode === 'favorite' ? true : undefined,
        is_hidden: filterMode === 'hidden' ? true : false,
        min_price: minPrice > 0 ? minPrice : undefined,
        search: searchQuery.trim() || undefined,
        page_size: 60,
      });
      setOrders(data.items);
      setStats({
        total: data.total,
        favorites: data.items.filter((i) => i.is_favorite).length,
      });
    } catch (e) {
      console.error('Failed to load FL orders', e);
    } finally {
      setLoading(false);
    }
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await api.triggerFlPoll();
      setTimeout(() => {
        loadOrders();
        setRefreshing(false);
      }, 1500);
    } catch {
      setRefreshing(false);
    }
  };

  const toggleFavorite = async (order: BackendFLOrder, e: React.MouseEvent) => {
    e.stopPropagation();
    const newFav = !order.is_favorite;
    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, is_favorite: newFav } : o))
    );
    try {
      await api.updateFlInteraction(order.id, { is_favorite: newFav });
    } catch (err) {
      console.error('Failed to update favorite', err);
    }
  };

  const hideOrder = async (orderId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    try {
      await api.updateFlInteraction(orderId, { is_hidden: true });
    } catch (err) {
      console.error('Failed to hide order', err);
    }
  };

  // Локальная фильтрация по поисковой строке
  const displayedOrders = orders.filter((o) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      o.title.toLowerCase().includes(q) ||
      (o.description && o.description.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar */}
      <div className="bg-[#0b0b0e]/90 border border-white/10 rounded-2xl p-4 sm:p-5 backdrop-blur-md shadow-2xl">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          {/* Sub-tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-white/5 border border-white/10 rounded-xl">
            <button
              onClick={() => setFilterMode('all')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterMode === 'all'
                  ? 'bg-white text-black font-semibold shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <span>Все заказы</span>
              {stats.total > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                    filterMode === 'all'
                      ? 'bg-black/15 text-black'
                      : 'bg-white/10 text-neutral-300'
                  }`}
                >
                  {stats.total}
                </span>
              )}
            </button>
            <button
              onClick={() => setFilterMode('favorite')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterMode === 'favorite'
                  ? 'bg-amber-400 text-black font-semibold shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Star className="w-3.5 h-3.5 fill-current" />
              <span>Избранное</span>
              {stats.favorites > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                    filterMode === 'favorite'
                      ? 'bg-black/20 text-black'
                      : 'bg-white/10 text-neutral-300'
                  }`}
                >
                  {stats.favorites}
                </span>
              )}
            </button>
            <button
              onClick={() => setFilterMode('hidden')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterMode === 'hidden'
                  ? 'bg-neutral-700 text-white font-semibold shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>Скрытые</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="flex-1 max-w-md relative">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Поиск по ключевым словам (fastapi, бот, figma)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-neutral-900/90 border border-white/10 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white/30 transition-colors"
            />
          </div>

          {/* Right Controls: LIVE Toggle + Refresh */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* ⚡ LIVE Toggle Switch & Status Widget */}
            <div className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl border transition-all ${
              liveEnabled
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.12)]'
                : 'bg-white/[0.04] border-white/10 text-neutral-500'
            }`}>
              <button
                type="button"
                onClick={() => setLiveEnabled(!liveEnabled)}
                className="flex items-center gap-2 cursor-pointer focus:outline-none select-none"
                title={liveEnabled ? "Live-мониторинг активен (опрос каждые 15-20 сек). Нажмите, чтобы приостановить." : "Live-мониторинг на паузе. Нажмите, чтобы включить."}
              >
                <div className="flex items-center gap-1.5">
                  <Zap className={`w-3.5 h-3.5 ${liveEnabled ? 'text-emerald-400 fill-emerald-400 animate-pulse' : 'text-neutral-500'}`} />
                  <span className="text-xs font-bold tracking-wider">LIVE</span>
                </div>

                {/* Beacon Indicator */}
                {liveEnabled ? (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                ) : (
                  <span className="inline-flex rounded-full h-2 w-2 bg-neutral-600"></span>
                )}

                {/* Countdown / Status Label */}
                <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded-md ${
                  liveEnabled
                    ? (workerStatus === 'polling' ? 'bg-emerald-500/20 text-emerald-300 font-medium' : 'bg-black/30 text-emerald-300')
                    : 'bg-neutral-800 text-neutral-500'
                }`}>
                  {liveEnabled
                    ? (workerStatus === 'polling' ? '⏳ Опрос FL...' : `${secondsUntilNextPoll}с`)
                    : 'Пауза'}
                </span>

                {/* Pill Switch */}
                <div className={`w-8 h-4 rounded-full transition-colors relative p-0.5 ml-0.5 ${liveEnabled ? 'bg-emerald-500' : 'bg-neutral-700'}`}>
                  <div className={`w-3 h-3 rounded-full bg-white transition-transform ${liveEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
              </button>

              {/* Sound Notification Toggle */}
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                title={soundEnabled ? 'Звуковое оповещение при новом заказе включено' : 'Звуковое оповещение отключено'}
                className={`p-1 rounded-md transition-colors cursor-pointer ${
                  soundEnabled
                    ? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20'
                    : 'text-neutral-600 hover:text-neutral-400 hover:bg-white/5'
                }`}
              >
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Manual Refresh Button */}
            <button
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-3.5 py-2 bg-white/10 hover:bg-white/15 active:scale-95 border border-white/10 rounded-xl text-xs font-medium text-white transition-all cursor-pointer shrink-0"
              title="Принудительно запросить свежие проекты сейчас"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Опрос...' : 'Проверить FL'}</span>
            </button>
          </div>
        </div>

        {/* Categories Pills, Budget Quick-select & Anti-ban Badge */}
        <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap items-center justify-between gap-3">
          {/* Categories */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-mono text-neutral-500 uppercase mr-1">Ниша:</span>
            <button
              onClick={() => setSelectedCat('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all ${
                selectedCat === 'all'
                  ? 'bg-white/15 border-white/30 text-white font-medium'
                  : 'bg-white/[0.03] border-white/5 text-neutral-400 hover:text-white'
              }`}
            >
              Все
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCat(cat.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all ${
                  selectedCat === cat.id
                    ? 'bg-white/15 border-white/30 text-white font-medium'
                    : 'bg-white/[0.03] border-white/5 text-neutral-400 hover:text-white'
                }`}
              >
                {cat.name.split('(')[0].trim()}
              </button>
            ))}
          </div>

          {/* Right: Min Price + Anti-ban Protection Indicator */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Min Price Quick Buttons */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono text-neutral-500 uppercase mr-1">Бюджет:</span>
              {[0, 10000, 25000, 50000].map((bp) => (
                <button
                  key={bp}
                  onClick={() => setMinPrice(bp)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-all ${
                    minPrice === bp
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-medium'
                      : 'bg-white/[0.03] border-white/5 text-neutral-400 hover:text-white'
                  }`}
                >
                  {bp === 0 ? 'Все' : `${bp / 1000}к+ ₽`}
                </button>
              ))}
            </div>

            {/* Anti-Ban Shield Badge */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/10 text-[10px] font-mono text-neutral-400"
              title="Безопасный цикл: ротация заголовков, джиттер 15-20 сек и round-robin исключают блокировку IP"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Защита IP (15-20с)</span>
              {lastPollTime && <span className="text-neutral-500">| {lastPollTime}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Orders Feed */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center gap-3 text-neutral-500 font-mono text-xs">
          <RefreshCw className="w-6 h-6 animate-spin text-neutral-400" />
          <span>Загрузка заказов с биржи FL.ru...</span>
        </div>
      ) : displayedOrders.length === 0 ? (
        <div className="bg-[#0b0b0e]/70 border border-white/10 rounded-2xl p-12 text-center text-neutral-400">
          <Briefcase className="w-10 h-10 mx-auto mb-3 text-neutral-600" />
          <h3 className="font-semibold text-sm text-neutral-200">Заказы не найдены</h3>
          <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
            {filterMode === 'favorite'
              ? 'В избранном пока нет заказов. Нажмите звёздочку на любой карточке, чтобы добавить.'
              : 'Фоновый воркер опрашивает ленту FL.ru каждые 15-20 сек. Попробуйте нажать «Проверить FL» или изменить фильтры.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {displayedOrders.map((ord) => {
            const isNegotiable = ord.is_negotiable || !ord.price_rub;
            const isNewLive = newLiveOrderIds.has(ord.id);

            return (
              <div
                key={ord.id}
                className={`bg-[#0b0b0e]/90 hover:bg-[#121217] rounded-2xl p-4 sm:p-5 transition-all shadow-lg group relative border ${
                  isNewLive
                    ? 'border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.18)] ring-1 ring-emerald-500/40'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  {/* Left: Title + Badges + Description */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isNewLive && (
                        <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold animate-pulse">
                          <Zap className="w-3 h-3 fill-current" /> ⚡ LIVE СВЕЖИЙ
                        </span>
                      )}
                      {ord.is_urgent && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-rose-500/15 border border-rose-500/30 text-rose-300 font-medium">
                          <Flame className="w-3 h-3 text-rose-400" /> Срочно
                        </span>
                      )}
                      {ord.is_pro_only && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/15 border border-amber-500/30 text-amber-300 font-medium">
                          <Crown className="w-3 h-3 text-amber-400" /> Только для PRO
                        </span>
                      )}
                      {ord.category_name && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/5 border border-white/10 text-neutral-400">
                          {ord.category_name}
                        </span>
                      )}
                    </div>

                    {/* Order Title */}
                    <h3 className="font-semibold text-base text-neutral-100 group-hover:text-white leading-snug">
                      <a
                        href={ord.url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline flex items-center gap-1.5"
                      >
                        <span>{ord.title}</span>
                        <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
                      </a>
                    </h3>

                    {/* Description */}
                    <p className="text-xs text-neutral-400 line-clamp-3 leading-relaxed">
                      {ord.description || 'Описание отсутствует.'}
                    </p>
                  </div>

                  {/* Right: Price + Actions */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-3 shrink-0 pt-1">
                    <div className="text-right">
                      {isNegotiable ? (
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-mono bg-sky-500/10 border border-sky-500/20 text-sky-300 font-medium">
                          По договоренности
                        </span>
                      ) : (
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-mono bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold tracking-wide">
                          {ord.price_rub?.toLocaleString('ru-RU')} ₽
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => toggleFavorite(ord, e)}
                        title={ord.is_favorite ? 'В избранном' : 'Добавить в избранное'}
                        className={`p-2 rounded-xl border transition-all cursor-pointer ${
                          ord.is_favorite
                            ? 'bg-amber-400/20 border-amber-400/40 text-amber-300'
                            : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        <Star className={`w-4 h-4 ${ord.is_favorite ? 'fill-current' : ''}`} />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => hideOrder(ord.id, e)}
                        title="Скрыть заказ"
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-400 hover:text-rose-400 transition-all cursor-pointer"
                      >
                        <EyeOff className="w-4 h-4" />
                      </button>

                      <a
                        href={ord.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black font-semibold text-xs rounded-xl hover:bg-neutral-200 transition-all"
                      >
                        <span>Открыть</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
