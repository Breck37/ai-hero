export interface LocationHints {
  latitude?: string;
  longitude?: string;
  city?: string;
  country?: string;
}

export type SearchResult = {
  date: string;
  title: string;
  url: string;
  snippet: string;
  scrapedContent: string;
};
