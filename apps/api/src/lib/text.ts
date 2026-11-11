// "Ifd*Açaí  do Zé" -> "IFD*ACAI DO ZE". Base pra comparar descrições de extrato.
export function normalizeDescription(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}
