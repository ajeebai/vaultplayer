
export const formatDuration = (seconds?: number): string => {
  if (seconds === undefined || isNaN(seconds) || seconds < 0) {
    return '00:00';
  }

  const date = new Date(0);
  date.setSeconds(seconds);
  const timeString = date.toISOString().substr(11, 8);

  // Don't show hours if video is less than an hour
  if (seconds < 3600) {
    return timeString.substr(3);
  }
  return timeString;
};
