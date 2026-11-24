/**
 * "joão  DA silva" -> "João Da Silva": first letter of each word upper case, the rest lower case.
 * Mirrors the database trigger (initcap) so app and database always agree.
 */
export function formatarNomeProprio(nome: unknown): string {
  return String(nome ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR')
    .replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toLocaleUpperCase('pt-BR'))
}
