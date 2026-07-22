const LIFECYCLE_STAGES = ['Registered', 'Growing', 'Harvested', 'Quality Checked', 'Transported', 'Delivered'];

const SUPPLY_CHAIN_STAGES = ['farmer', 'mandi', 'transport', 'retailer'];

const SUPPLY_CHAIN_TO_LIFECYCLE = {
  mandi: 'Harvested',
  transport: 'Quality Checked',
  retailer: 'Transported',
};

const LIFECYCLE_TO_SUPPLY_CHAIN = {
  'Quality Checked': 'mandi',
  Transported: 'transport',
  Delivered: 'retailer',
};

const isLifecycleAtLeast = (lifecycleStage, requiredStage) => {
  const currentIndex = LIFECYCLE_STAGES.indexOf(lifecycleStage);
  const requiredIndex = LIFECYCLE_STAGES.indexOf(requiredStage);
  if (currentIndex === -1 || requiredIndex === -1) return false;
  return currentIndex >= requiredIndex;
};

const isSupplyChainAtLeast = (supplyChainStage, requiredStage) => {
  const currentIndex = SUPPLY_CHAIN_STAGES.indexOf(supplyChainStage);
  const requiredIndex = SUPPLY_CHAIN_STAGES.indexOf(requiredStage);
  if (currentIndex === -1 || requiredIndex === -1) return false;
  return currentIndex >= requiredIndex;
};

module.exports = {
  LIFECYCLE_STAGES,
  SUPPLY_CHAIN_STAGES,
  SUPPLY_CHAIN_TO_LIFECYCLE,
  LIFECYCLE_TO_SUPPLY_CHAIN,
  isLifecycleAtLeast,
  isSupplyChainAtLeast,
};
