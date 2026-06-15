export const calculateMaxYear = (
  month: number | null,
  day: number | null,
  today: Date = new Date()
): number => {
  const currentYear = today.getFullYear();

  if (month === null || day === null) {
    return currentYear - 18;
  }

  const todayMonth = today.getMonth() + 1; // getMonth() is 0-indexed
  const todayDay = today.getDate();

  // Compare selected month/day against today's month/day
  if (month < todayMonth || (month === todayMonth && day <= todayDay)) {
    // Selected date is today or earlier in the calendar year
    return currentYear - 18;
  } else {
    // Selected date is later in the calendar year
    return currentYear - 19;
  }
};
