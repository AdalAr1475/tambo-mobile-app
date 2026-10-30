const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];

export const money = (n: number) => `S/ ${n.toFixed(2)}`;

export const round2 = (n: number) => Math.round(n * 100) / 100;

const pad = (n: number) => String(n).padStart(2, '0');

export const time24 = (ts: number) => {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const time12 = (ts: number) => {
  const d = new Date(ts);
  const h = d.getHours() % 12 || 12;
  return `${h}:${pad(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
};

export const shortDate = (ts: number) => {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

export const isToday = (ts: number) => new Date(ts).toDateString() === new Date().toDateString();

export const friendlyDate = (ts: number) =>
  isToday(ts) ? `Hoy, ${time12(ts)}` : `${shortDate(ts)}, ${time12(ts)}`;

export const pluralize = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
