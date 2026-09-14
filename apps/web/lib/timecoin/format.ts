export function formatUnits(units: bigint, unitsPerCoin: bigint, maxDecimals = 8): string {
  const negative = units < 0n;
  const abs = negative ? -units : units;
  const whole = abs / unitsPerCoin;
  const frac = abs % unitsPerCoin;
  const decimals = unitsPerCoin.toString().length - 1;
  let fracStr = frac.toString().padStart(decimals, "0").slice(0, maxDecimals);
  fracStr = fracStr.replace(/0+$/, "");
  const sign = negative ? "-" : "";
  return fracStr ? `${sign}${whole}.${fracStr}` : `${sign}${whole}`;
}
