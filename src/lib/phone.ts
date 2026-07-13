export function phoneDigits(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.startsWith('55') && (digits.length === 12 || digits.length === 13)
    ? digits.slice(2)
    : digits;
}

export function normalizePhone(value: string): string {
  return phoneDigits(value);
}

export function isValidBrazilianPhone(value: string): boolean {
  const digits = phoneDigits(value);
  return (digits.length === 10 || digits.length === 11) && /^[1-9]{2}[2-9]\d+$/.test(digits);
}

export function formatBrazilianPhone(value: string): string {
  const hadCountryCode = value.trim().startsWith('+55');
  const digits = phoneDigits(value).slice(0, 11);
  if (!digits) return '';
  if (digits.length === 1) return hadCountryCode ? `+55 ${digits}` : digits;
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  let local = digits.length === 2 ? `(${ddd})` : `(${ddd}) ${rest}`;
  if (rest.length > 4) {
    const split = rest.length > 8 ? 5 : 4;
    local = `(${ddd}) ${rest.slice(0, split)}-${rest.slice(split)}`;
  }
  return hadCountryCode ? `+55 ${local}` : local;
}
