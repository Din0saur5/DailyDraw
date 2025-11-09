const UTC_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'UTC',
});

export const utcToday = (date = new Date()) => UTC_FORMATTER.format(date);

export const countDownToUtcMidnight = (date = new Date()) => {
  const nextMidnight = new Date(date);
  nextMidnight.setUTCHours(24, 0, 0, 0);
  return Math.max(0, nextMidnight.getTime() - date.getTime());
};

export const formatCountdown = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => value.toString().padStart(2, '0')).join(':');
};
