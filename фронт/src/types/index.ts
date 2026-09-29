export type SiteStatusType = 
  | 'No Website' 
  | 'No SSL' 
  | 'Not Responsive' 
  | 'No Analytics' 
  | 'HTTPS OK'
  | 'Site Down';

export interface Lead {
  id: number;
  name: string;
  rating: number;
  reviewsCount?: number;
  category: string;
  phone: string;
  allPhones?: string[];
  email?: string;
  telegram: string;
  status: SiteStatusType;
  statusBadge?: string;
  website?: string;
  finalUrl?: string;
  cardUrl?: string;
  hasWebsite: boolean;
  mobileFriendly: boolean;
  hasSsl: boolean;
  hasAnalytics: boolean;
  detectedCms?: string;
  lastUpdatedYear?: number;
  address?: string;
  leadScore?: number;
  pitch?: {
    pain?: string;
    solution?: string;
    opening_phrase?: string;
    full_text?: string;
  };
}

export interface SearchConfig {
  niche: string;
  city: string;
  maps: string;
  limit: number;
  campaignId?: number;
}
