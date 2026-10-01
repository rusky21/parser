import React, { useState } from 'react';
import { Search, MapPin, ChevronDown, ArrowRight, Briefcase, LogOut } from 'lucide-react';

interface SearchHeroProps {
  niche: string;
  setNiche: (val: string) => void;
  city: string;
  setCity: (val: string) => void;
  onSearch: () => void;
  onOpenFl: () => void;
  isDropping: boolean;
}

const CITIES = [
  'Казань',
  'Москва',
  'Санкт-Петербург',
  'Екатеринбург',
  'Новосибирск',
  'Нижний Новгород',
];

const NICHES = [
  'Стоматологии',
  'Автосервисы',
  'Юридические услуги',
  'Салоны красоты',
  'Недвижимость',
  'Клининг',
];

export const SearchHero: React.FC<SearchHeroProps> = ({
  niche,
  setNiche,
  city,
  setCity,
  onSearch,
  onOpenFl,
  isDropping,
}) => {
  const [cityOpen, setCityOpen] = useState(false);
  const [nicheSuggestOpen, setNicheSuggestOpen] = useState(false);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onSearch();
  };

  return (
    <div
      className={`relative z-10 min-h-screen flex flex-col justify-center px-6 sm:px-12 md:px-20 lg:px-28 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isDropping
          ? 'translate-y-[120vh] opacity-0 pointer-events-none'
          : 'translate-y-0 opacity-100'
      }`}
    >
      {/* Top Bar Quick Link */}
      <div className="absolute top-6 right-6 sm:top-8 sm:right-12 z-30 flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenFl}
          className="flex items-center gap-2.5 px-4 py-2.5 bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 hover:border-emerald-500/40 rounded-2xl text-xs font-medium text-neutral-200 hover:text-white transition-all backdrop-blur-md cursor-pointer group shadow-lg"
        >
          <div className="p-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 group-hover:scale-110 transition-transform">
            <Briefcase className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold">Биржа FL.ru</span>
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
        </button>

        <a
          href="/logout"
          title="Выйти из системы"
          className="flex items-center gap-1.5 px-3.5 py-2.5 bg-red-500/10 hover:bg-red-500/20 active:scale-95 border border-red-500/25 rounded-2xl text-xs font-medium text-red-300 hover:text-red-200 transition-all backdrop-blur-md cursor-pointer shadow-lg"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Выйти</span>
        </a>
      </div>

      <div className="max-w-[480px] w-full">

        {/* Search Inputs Container */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Top Row: Niche Input + Search Button */}
          <div className="relative flex items-center gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-neutral-400">
                <Search className="w-5 h-5 text-neutral-400" />
              </div>
              <input
                type="text"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                onFocus={() => setNicheSuggestOpen(true)}
                onBlur={() => setTimeout(() => setNicheSuggestOpen(false), 200)}
                placeholder="Найти нишу"
                className="w-full pl-12 pr-4 py-3.5 bg-[#101013] text-neutral-100 placeholder-neutral-500 rounded-2xl border border-white/10 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all font-sans text-[15px]"
              />

              {/* Niche Autocomplete Dropdown */}
              {nicheSuggestOpen && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-[#121215] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 backdrop-blur-xl">
                  {NICHES.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onMouseDown={() => {
                        setNiche(item);
                        setNicheSuggestOpen(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-neutral-300 hover:bg-white/10 transition-colors flex items-center justify-between"
                    >
                      <span>{item}</span>
                      <span className="text-xs text-neutral-500 font-mono">Выбрать</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-3.5 bg-white hover:bg-neutral-200 active:scale-95 text-black font-medium text-[15px] rounded-2xl transition-all shadow-[0_4px_20px_rgba(255,255,255,0.15)] shrink-0 cursor-pointer"
            >
              <span>Поиск</span>
              <ArrowRight className="w-4 h-4 stroke-[2.2]" />
            </button>
          </div>

          {/* Bottom Row: City Selector */}
          <div>
            <label className="block text-xs font-mono text-neutral-400 mb-1.5 tracking-wider">
              Город
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setCityOpen(!cityOpen)}
                className="w-full pl-4 pr-4 py-3.5 bg-[#101013] hover:bg-[#15151a] text-left rounded-2xl border border-white/10 hover:border-white/25 flex items-center justify-between transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1 rounded bg-white/5 border border-white/10 group-hover:border-white/20 transition-colors">
                    <MapPin className="w-4 h-4 text-neutral-300" />
                  </div>
                  <span className={city ? 'text-neutral-100 text-[15px]' : 'text-neutral-500 text-[15px]'}>
                    {city || 'Выберите город'}
                  </span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${
                    cityOpen ? 'rotate-180 text-white' : ''
                  }`}
                />
              </button>

              {/* City Selection Modal/Dropdown */}
              {cityOpen && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-[#121215] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 backdrop-blur-xl">
                  {CITIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setCity(c);
                        setCityOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${
                        city === c
                          ? 'bg-white/15 text-white font-medium'
                          : 'text-neutral-300 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                        <span>{c}</span>
                      </div>
                      {city === c && (
                        <span className="text-xs text-neutral-400 font-mono">✓ выбрано</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick direct access to FL.ru orders */}
          <div className="pt-3">
            <button
              type="button"
              onClick={onOpenFl}
              className="group w-full flex items-center justify-between p-3.5 bg-gradient-to-r from-emerald-500/10 via-white/[0.04] to-transparent hover:from-emerald-500/20 hover:to-white/10 border border-emerald-500/20 hover:border-emerald-500/40 rounded-2xl transition-all cursor-pointer shadow-lg"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 group-hover:scale-105 transition-transform">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white group-hover:text-emerald-300 transition-colors">
                      Биржа заказов FL.ru
                    </span>
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      LIVE
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Перейти сразу к ленте фриланс-заказов в реальном времени
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-white group-hover:translate-x-1 transition-all shrink-0 ml-2" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
