import type { Lead, SiteStatusType } from '../types';
import type { BackendLead } from '../api/client';

export function mapBackendLeadToFrontend(b: BackendLead): Lead {
  let status: SiteStatusType = 'HTTPS OK';
  if (b.status_badge === 'NO_SSL') status = 'No SSL';
  else if (b.status_badge === 'NOT_RESPONSIVE') status = 'Not Responsive';
  else if (b.status_badge === 'NO_ANALYTICS') status = 'No Analytics';
  else if (b.status_badge === 'NO_WEBSITE') status = 'No Website';
  else if (b.status_badge === 'SITE_DOWN') status = 'Site Down';

  return {
    id: b.id,
    name: b.name,
    rating: b.rating || 0,
    reviewsCount: b.reviews_count || 0,
    category: b.category || 'Компания',
    phone: b.primary_phone || (b.all_phones && b.all_phones[0]) || 'Не указан',
    allPhones: b.all_phones || [],
    email: b.email,
    telegram: b.telegram ? (b.telegram.startsWith('@') ? b.telegram : `@${b.telegram.split('/').pop()}`) : '',
    status: status,
    statusBadge: b.status_badge,
    website: b.website,
    finalUrl: b.final_url,
    cardUrl: b.card_url,
    hasWebsite: b.status_badge !== 'NO_WEBSITE',
    mobileFriendly: b.is_adaptive,
    hasSsl: b.has_ssl,
    hasAnalytics: b.has_analytics,
    detectedCms: b.detected_cms,
    lastUpdatedYear: b.last_updated_year,
    address: b.address,
    leadScore: b.lead_score,
    pitch: b.pitch,
  };
}
