/** "1 set", "3 sets", "1 rest day", "2 rest days". */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
