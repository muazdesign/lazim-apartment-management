export function numberToAmharic(n: number): string {
  if (n === 0) return 'ዜሮ';

  const units = ['', 'አንድ', 'ሁለት', 'ሶስት', 'አራት', 'አምስት', 'ስድስት', 'ሰባት', 'ስምንት', 'ዘጠኝ'];
  const tens = ['', 'አስር', 'ሃያ', 'ሰላሳ', 'አርባ', 'ሀምሳ', 'ስልሳ', 'ሰባ', 'ሰማንያ', 'ዘጠና'];

  function convertGroup(num: number): string {
    if (num === 0) return '';
    let result = '';

    if (num >= 100) {
      const h = Math.floor(num / 100);
      result += (h === 1 ? '' : units[h] + ' ') + 'መቶ ';
      num %= 100;
    }

    if (num >= 10) {
      const t = Math.floor(num / 10);
      const u = num % 10;
      if (num === 10) {
        result += tens[1] + ' ';
      } else {
        result += tens[t] + (u > 0 ? ' ' + units[u] : '') + ' ';
      }
    } else if (num > 0) {
      result += units[num] + ' ';
    }

    return result.trim();
  }

  let result = '';

  if (n >= 1000000) {
    const m = Math.floor(n / 1000000);
    result += (m === 1 ? 'አንድ ' : convertGroup(m) + ' ') + 'ሚልዮን ';
    n %= 1000000;
  }

  if (n >= 1000) {
    const th = Math.floor(n / 1000);
    // Note: for exactly 1000 it is sometimes 'አንድ ሺህ' and sometimes 'ሺህ'. 
    // We will use 'አንድ ሺህ' for clarity unless `th` is not used.
    // Let's use `convertGroup(th) + ' ሺህ'` except if th is 1, let's just do 'አንድ ሺህ' or 'ሺህ'. Let's do 'አንድ ሺህ' if it's the start, or just evaluate convertGroup(1) -> 'አንድ'
    result += (th === 1 ? '' : convertGroup(th) + ' ') + 'ሺህ ';
    n %= 1000;
  }

  if (n > 0) {
    result += convertGroup(n);
  }

  result = result.replace(/\s+/g, ' ').trim();

  // If it ends up as just "ሺህ" from 1000, maybe output "አንድ ሺህ" or just "ሺህ"
  if (result === 'ሺህ') result = 'አንድ ሺህ';
  
  return result;
}
