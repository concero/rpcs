export function findThresholdByMass(arr: number[], minShare = 0.3): number {
  const freq = new Map<number, number>();
  let total = 0;

  for (const x of arr) {
    if (x === 0) continue;
    freq.set(x, (freq.get(x) || 0) + 1);
    total++;
  }

  if (total === 0) return 0;

  const sorted = [...freq.entries()].sort((a, b) => a[0] - b[0]);

  let acc = 0;
  for (const [value, count] of sorted) {
    acc += count;
    if (acc / total >= minShare) return value;
  }

  return 0;
}
