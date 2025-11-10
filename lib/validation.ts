const USERNAME_REGEX = /^[A-Za-z0-9_.]{3,20}$/;

export const validateUsernameInput = (raw: string) => {
  const value = raw.trim();
  if (!value) {
    return 'Username is required.';
  }
  if (!USERNAME_REGEX.test(value)) {
    return '3-20 characters. Letters, numbers, underscores, and dots only.';
  }
  return null;
};

export const formatUtcToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(new Date());
