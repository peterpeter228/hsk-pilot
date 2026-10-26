/** Raw units are never routed through floating point. */
export function units(raw: string | null | undefined, decimals = 6, precision = 4): string {
  if (raw == null || !/^-?\d+$/.test(raw)) return 'Unavailable';
  const n = BigInt(raw), sign = n < 0n ? '−' : '', absolute = n < 0n ? -n : n;
  const divisor = 10n ** BigInt(decimals);
  const whole = (absolute / divisor).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = (absolute % divisor).toString().padStart(decimals,'0').slice(0,precision).replace(/0+$/,'');
  return sign + whole + (fraction ? '.'+fraction : '');
}
export function percent(bps:number):string { return `${bps / 100}%`; }
export function timestamp(value:string | number | undefined): string { if(value == null) return 'Unavailable'; const date = new Date(typeof value === 'number' && value < 1e12 ? value*1000:value);return Number.isNaN(date.getTime())?'Unavailable':date.toISOString().replace('T',' ').replace('.000Z',' UTC'); }
export function decimalToRaw(value:string, decimals=6):string { if(!/^\d+(\.\d+)?$/.test(value)) throw new Error('Enter a non-negative decimal amount, not scientific notation.'); const [whole,fraction='']=value.split('.'); if(fraction.length>decimals) throw new Error(`Use at most ${decimals} decimal places.`);return BigInt(whole+fraction.padEnd(decimals,'0')).toString(); }
