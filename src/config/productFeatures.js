export const productFeatures = Object.freeze({
  paidBeta: false,
  cloudProfiles: false,
  pushAlerts: false,
  approvedMarketIntegrations: false,
});

export const betaPlans = Object.freeze([
  {
    id: "driver",
    name: "Driver",
    status: "planned",
    includes: ["Saved profiles", "Load comparison", "Chrome extension"],
  },
  {
    id: "fleet",
    name: "Small Fleet",
    status: "planned",
    includes: ["Multiple driver profiles", "Shared preferences", "Priority feedback"],
  },
]);
