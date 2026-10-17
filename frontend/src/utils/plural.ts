/** "1 rua pintada" / "3 ruas pintadas": número + a forma certa, sem "(s)". */
export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count.toLocaleString('pt-BR')} ${count === 1 ? singular : pluralForm}`;
}
