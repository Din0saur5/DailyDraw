export const utcDayRange = (now = new Date()) => {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 1);
  return { start, end };
};

export const formatDateKey = (date = new Date()) => {
  return date.toISOString().slice(0, 10);
};
