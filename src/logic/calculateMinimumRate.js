function roundUp(value, increment) {
  return Math.ceil(value / increment) * increment;
}

export function calculateMinimumRate(input) {
  const loadedMiles = Math.max(0, Number(input.loadedMiles) || 0);
  const deadheadMiles = Math.max(0, Number(input.deadheadMiles) || 0);
  const mpg = Math.max(0.1, Number(input.mpg) || 6.5);
  const fuelPrice = Math.max(0, Number(input.fuelPrice) || 4);
  const fixedCostPerMile = Math.max(
    0,
    Number(input.fixedCostPerMile) || 0.65,
  );
  const currentRate = Math.max(0, Number(input.loadRate) || 0);
  const targetAllInRpm = Math.max(0, Number(input.targetAllInRpm) || 2.25);
  const targetProfit = Math.max(0, Number(input.targetProfit) || 500);

  const totalMiles = loadedMiles + deadheadMiles;
  const fuelCost = (totalMiles / mpg) * fuelPrice;
  const fixedCost = totalMiles * fixedCostPerMile;
  const operatingCost = fuelCost + fixedCost;
  const rateForRpm = totalMiles * targetAllInRpm;
  const rateForProfit = operatingCost + targetProfit;
  const controllingTarget =
    rateForRpm >= rateForProfit ? "all-in RPM" : "minimum profit";
  const rawMinimumRate = Math.max(rateForRpm, rateForProfit);
  const minimumRate = roundUp(rawMinimumRate, 25);
  const askMore = Math.max(0, minimumRate - currentRate);

  return {
    totalMiles,
    operatingCost,
    rateForRpm,
    rateForProfit,
    controllingTarget,
    minimumRate,
    askMore,
    meetsTarget: currentRate >= minimumRate,
  };
}
