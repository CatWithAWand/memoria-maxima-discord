const UNITS = [
  { label: 'd', value: 24 * 60 * 60 * 1000 },
  { label: 'h', value: 60 * 60 * 1000 },
  { label: 'm', value: 60 * 1000 },
  { label: 's', value: 1000 },
];

export const formatUptime = (
  ms: number,
  includeMs: boolean = false,
): string => {
  let remaining = ms;
  const parts = UNITS.map(({ label, value }) => {
    const count = Math.floor(remaining / value);
    remaining %= value;
    return count ? `${count}${label}` : '';
  }).filter(Boolean);

  let result = parts.join(' ') || '0s';

  if (includeMs && remaining > 0) {
    result += ` ${remaining}ms`;
  }

  return result;
};
