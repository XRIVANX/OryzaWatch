// Helpers for dates, severity colors, and data formatting

export const formatDate = (dateStr: string): string => {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
};

export const getDiseaseAdvice = (diseaseName: string) => {
  const normalized = (diseaseName || '').toLowerCase();
  if (normalized.includes('blight') || normalized.includes('blb')) {
    return {
      severity: 'Critical (Level 4)',
      action: 'Drain excess water, avoid excessive nitrogen fertilizers, apply copper-based bactericides.',
      riskSpread: 'High velocity spread via wind & irrigation canals.',
      color: '#ef4444',
    };
  }
  if (normalized.includes('blast')) {
    return {
      severity: 'High (Level 3)',
      action: 'Apply tricyclazole or isoprothiolane at early heading stage, maintain proper water depth.',
      riskSpread: 'Airborne fungal spores active during high humidity.',
      color: '#f97316',
    };
  }
  if (normalized.includes('brown')) {
    return {
      severity: 'Moderate (Level 2)',
      action: 'Improve soil fertility with potassium and balanced NPK, apply certified foliar spray.',
      riskSpread: 'Nutrient-deficient paddy patches at risk.',
      color: '#eab308',
    };
  }
  return {
    severity: 'Monitoring (Level 1)',
    action: 'Maintain regular field scouting, log daily leaf specimen scans.',
    riskSpread: 'Normal baseline surveillance.',
    color: '#22c55e',
  };
};
