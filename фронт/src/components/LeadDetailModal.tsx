import React, { useState } from 'react';
import { X, Globe, ShieldAlert, Smartphone, BarChart3, Copy, Check, ExternalLink, Phone, Send } from 'lucide-react';
import type { Lead } from '../types';

interface LeadDetailModalProps {
  lead: Lead | null;
  onClose: () => void;
}

export const LeadDetailModal: React.FC<LeadDetailModalProps> = ({ lead, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!lead) return null;

  const pitchMessage = lead.pitch?.full_text || (lead.status === 'No Website'
    ? `Здравствуйте, ${lead.name}! Нашли вашу компанию на картах. Обратили внимание, что у вас еще нет сайта. Из-за этого вы теряете до 40-50% клиентов, которые ищут услуги в поиске Яндекса. Можем оперативно разработать для вас современный конверсионный сайт.`
    : `Здравствуйте, ${lead.name}! Нашли вашу организацию на картах. Провели экспресс-аудит вашего сайта (${lead.website || ''}): обнаружена проблема [${lead.status}], из-за чего клиенты со смартфонов могут уходить к конкурентам. Готовы показать, как это исправить и увеличить поток заявок.`);

  const openingPhrase = lead.pitch?.opening_phrase;

  const handleCopyPitch = () => {
    navigator.clipboard.writeText(openingPhrase || pitchMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div 
        className="relative w-full max-w-lg bg-[#0e0e12] border border-white/15 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-neutral-400">ID #{lead.id}</span>
              {lead.leadScore !== undefined && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono font-medium">
                  Score: {lead.leadScore}/100
                </span>
              )}
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-neutral-300 font-mono">
                {lead.category}
              </span>
            </div>
            <h3 className="text-xl font-bold text-white">{lead.name}</h3>
            <p className="text-xs text-neutral-400 mt-0.5">{lead.address}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Audit Details */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#15151b] border border-white/5 rounded-xl p-3">
              <div className="flex items-center gap-2 text-xs text-neutral-400 mb-1">
                <Globe className="w-3.5 h-3.5" />
                <span>Наличие сайта</span>
              </div>
              <div className="text-sm font-medium text-white flex items-center gap-1.5 truncate">
                {lead.hasWebsite ? (
                  <a href={lead.website} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline truncate">
                    {lead.website}
                  </a>
                ) : (
                  <span className="text-rose-400">Сайт отсутствует</span>
                )}
              </div>
            </div>

            <div className="bg-[#15151b] border border-white/5 rounded-xl p-3">
              <div className="flex items-center gap-2 text-xs text-neutral-400 mb-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>SSL / Безопасность</span>
              </div>
              <div className="text-sm font-medium text-white">
                {lead.hasSsl ? (
                  <span className="text-emerald-400">HTTPS Защищен</span>
                ) : (
                  <span className="text-amber-400">Незащищенное (No SSL)</span>
                )}
              </div>
            </div>

            <div className="bg-[#15151b] border border-white/5 rounded-xl p-3">
              <div className="flex items-center gap-2 text-xs text-neutral-400 mb-1">
                <Smartphone className="w-3.5 h-3.5" />
                <span>Мобильная версия</span>
              </div>
              <div className="text-sm font-medium text-white">
                {lead.mobileFriendly ? (
                  <span className="text-emerald-400">Адаптивный</span>
                ) : (
                  <span className="text-amber-400">Не адаптивен (Not Responsive)</span>
                )}
              </div>
            </div>

            <div className="bg-[#15151b] border border-white/5 rounded-xl p-3">
              <div className="flex items-center gap-2 text-xs text-neutral-400 mb-1">
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Яндекс Метрика</span>
              </div>
              <div className="text-sm font-medium text-white">
                {lead.hasAnalytics ? (
                  <span className="text-emerald-400">Установлена</span>
                ) : (
                  <span className="text-neutral-400">Нет аналитики</span>
                )}
              </div>
            </div>
          </div>

          {/* Contacts */}
          <div className="bg-[#15151b] border border-white/5 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm text-neutral-300">
              <Phone className="w-4 h-4 text-neutral-400" />
              <span>{lead.phone}</span>
            </div>
            {lead.email && (
              <span className="text-xs text-neutral-400 font-mono">
                ✉️ {lead.email}
              </span>
            )}
            {lead.telegram && (
              <a
                href={`https://t.me/${lead.telegram.replace('@', '')}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 font-mono bg-sky-950/40 border border-sky-800/40 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{lead.telegram}</span>
                <ExternalLink className="w-3 h-3 ml-0.5 opacity-60" />
              </a>
            )}
          </div>

          {/* Pitch Template for Cold Outreach */}
          <div className="bg-[#121216] border border-white/10 rounded-xl p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-neutral-400">
                Скрипт звонка менеджера:
              </span>
              <button
                onClick={handleCopyPitch}
                className="flex items-center gap-1.5 text-xs text-neutral-300 hover:text-white bg-white/10 hover:bg-white/15 px-2.5 py-1 rounded-lg transition-all"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Скопировано!' : 'Копировать фразу'}</span>
              </button>
            </div>
            <p className="text-xs text-neutral-300 font-sans leading-relaxed select-text bg-[#09090b] p-2.5 rounded-lg border border-white/5 whitespace-pre-line">
              {openingPhrase ? `«${openingPhrase}»` : pitchMessage}
            </p>
          </div>
        </div>
      </div>
    </div>

  );
};
