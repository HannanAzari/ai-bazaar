const second = ["blue", "cloud", "garden", "hannan", "paper", "rain", "river", "tea", "thread", "tiny", "velvet", "window"];
const third = ["arch", "bell", "door", "lab", "lamp", "lantern", "room", "song", "studio", "table", "yard", "zine"];

export function normalizeAddressWord(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "").slice(0, 20);
}

export function createThreeWordAddress(villagePrefix: string, seed = Date.now(), customSecond?: string, customThird?: string) {
  const pick = (words: string[], offset: number) => words[(seed + offset) % words.length];
  const prefix = normalizeAddressWord(villagePrefix);
  const middle = normalizeAddressWord(customSecond ?? "") || pick(second, 5);
  const ending = normalizeAddressWord(customThird ?? "") || pick(third, 9);
  return `${prefix}.${middle}.${ending}`;
}
