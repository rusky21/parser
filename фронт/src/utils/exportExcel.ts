import * as XLSX from 'xlsx';
import type { Lead } from '../types';

export const exportLeadsToExcel = (leads: Lead[], filename = 'LeadGen_Audit_Report.xlsx') => {
  const data = leads.map((lead) => ({
    '#': lead.id,
    'Компания': lead.name,
    'Категория': lead.category,
    'Рейтинг': `${lead.rating} / 5`,
    'Телефон': lead.phone,
    'Telegram': lead.telegram,
    'Статус Сайта': lead.status,
    'Сайт': lead.website || 'Отсутствует',
    'SSL-сертификат': lead.hasSsl ? 'Есть' : 'Нет',
    'Мобильная адаптивность': lead.mobileFriendly ? 'Да' : 'Нет',
    'Веб-аналитика': lead.hasAnalytics ? 'Установлена' : 'Отсутствует',
    'Адрес': lead.address || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Лиды и Аудит');

  // Auto-fit column widths
  const colWidths = [
    { wch: 4 },
    { wch: 22 },
    { wch: 15 },
    { wch: 10 },
    { wch: 18 },
    { wch: 20 },
    { wch: 16 },
    { wch: 25 },
    { wch: 16 },
    { wch: 22 },
    { wch: 16 },
    { wch: 30 },
  ];
  worksheet['!cols'] = colWidths;

  XLSX.writeFile(workbook, filename);
};
