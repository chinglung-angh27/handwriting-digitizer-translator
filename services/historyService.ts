export interface ScanHistoryItem {
  id: string;
  imageUrl: string;
  extracted: string;
  translated: string;
  targetLanguage: string;
  timestamp: number;
}

export const historyService = {
  saveScan: (item: ScanHistoryItem) => {
    const history = historyService.getHistory();
    const newHistory = [item, ...history].slice(0, 5);
    localStorage.setItem('handwriting_ai_history', JSON.stringify(newHistory));
  },

  getHistory: (): ScanHistoryItem[] => {
    const data = localStorage.getItem('handwriting_ai_history');
    return data ? JSON.parse(data) : [];
  },

  clearHistory: () => {
    localStorage.removeItem('handwriting_ai_history');
  }
};
