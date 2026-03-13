/**
 * WATTZ UP v2 - EV Vehicle Database
 * Popular EVs with compatible plug types and specs
 */

export interface EVVehicle {
  id: string;
  make: string;
  model: string;
  year: string; // range like "2021-2025"
  plugTypes: string[]; // compatible AFDC plug type codes
  batteryKwh: number;
  rangeKm: number; // EPA estimated range
  maxChargeKw: number; // max DC fast charge rate
}

export const EV_VEHICLES: EVVehicle[] = [
  // Tesla
  { id: 'tesla-model3', make: 'Tesla', model: 'Model 3', year: '2024+', plugTypes: ['NACS', 'TESLA'], batteryKwh: 60, rangeKm: 460, maxChargeKw: 250 },
  { id: 'tesla-modely', make: 'Tesla', model: 'Model Y', year: '2024+', plugTypes: ['NACS', 'TESLA'], batteryKwh: 75, rangeKm: 500, maxChargeKw: 250 },
  { id: 'tesla-models', make: 'Tesla', model: 'Model S', year: '2024+', plugTypes: ['NACS', 'TESLA'], batteryKwh: 100, rangeKm: 630, maxChargeKw: 250 },
  { id: 'tesla-modelx', make: 'Tesla', model: 'Model X', year: '2024+', plugTypes: ['NACS', 'TESLA'], batteryKwh: 100, rangeKm: 570, maxChargeKw: 250 },
  { id: 'tesla-cybertruck', make: 'Tesla', model: 'Cybertruck', year: '2024+', plugTypes: ['NACS', 'TESLA'], batteryKwh: 123, rangeKm: 515, maxChargeKw: 250 },

  // Hyundai
  { id: 'hyundai-ioniq5', make: 'Hyundai', model: 'IONIQ 5', year: '2022+', plugTypes: ['CCS', 'J1772'], batteryKwh: 77, rangeKm: 480, maxChargeKw: 350 },
  { id: 'hyundai-ioniq6', make: 'Hyundai', model: 'IONIQ 6', year: '2023+', plugTypes: ['CCS', 'J1772'], batteryKwh: 77, rangeKm: 580, maxChargeKw: 350 },

  // Kia
  { id: 'kia-ev6', make: 'Kia', model: 'EV6', year: '2022+', plugTypes: ['CCS', 'J1772'], batteryKwh: 77, rangeKm: 500, maxChargeKw: 350 },
  { id: 'kia-ev9', make: 'Kia', model: 'EV9', year: '2024+', plugTypes: ['CCS', 'J1772'], batteryKwh: 99, rangeKm: 480, maxChargeKw: 250 },

  // Ford
  { id: 'ford-mustangmache', make: 'Ford', model: 'Mustang Mach-E', year: '2021+', plugTypes: ['CCS', 'J1772'], batteryKwh: 91, rangeKm: 500, maxChargeKw: 150 },
  { id: 'ford-f150lightning', make: 'Ford', model: 'F-150 Lightning', year: '2022+', plugTypes: ['CCS', 'J1772'], batteryKwh: 131, rangeKm: 515, maxChargeKw: 150 },

  // Chevrolet
  { id: 'chevy-equinoxev', make: 'Chevrolet', model: 'Equinox EV', year: '2024+', plugTypes: ['CCS', 'J1772'], batteryKwh: 85, rangeKm: 500, maxChargeKw: 150 },
  { id: 'chevy-blazerev', make: 'Chevrolet', model: 'Blazer EV', year: '2024+', plugTypes: ['CCS', 'J1772'], batteryKwh: 102, rangeKm: 515, maxChargeKw: 190 },

  // BMW
  { id: 'bmw-ix', make: 'BMW', model: 'iX', year: '2022+', plugTypes: ['CCS', 'J1772'], batteryKwh: 111, rangeKm: 520, maxChargeKw: 200 },
  { id: 'bmw-i4', make: 'BMW', model: 'i4', year: '2022+', plugTypes: ['CCS', 'J1772'], batteryKwh: 83, rangeKm: 480, maxChargeKw: 200 },

  // Mercedes
  { id: 'mercedes-eqe', make: 'Mercedes', model: 'EQE', year: '2023+', plugTypes: ['CCS', 'J1772'], batteryKwh: 90, rangeKm: 490, maxChargeKw: 170 },
  { id: 'mercedes-eqs', make: 'Mercedes', model: 'EQS', year: '2022+', plugTypes: ['CCS', 'J1772'], batteryKwh: 107, rangeKm: 560, maxChargeKw: 200 },

  // Rivian
  { id: 'rivian-r1t', make: 'Rivian', model: 'R1T', year: '2022+', plugTypes: ['CCS', 'J1772'], batteryKwh: 135, rangeKm: 500, maxChargeKw: 220 },
  { id: 'rivian-r1s', make: 'Rivian', model: 'R1S', year: '2022+', plugTypes: ['CCS', 'J1772'], batteryKwh: 135, rangeKm: 480, maxChargeKw: 220 },

  // Volkswagen
  { id: 'vw-id4', make: 'Volkswagen', model: 'ID.4', year: '2021+', plugTypes: ['CCS', 'J1772'], batteryKwh: 82, rangeKm: 440, maxChargeKw: 170 },
  { id: 'vw-id-buzz', make: 'Volkswagen', model: 'ID. Buzz', year: '2024+', plugTypes: ['CCS', 'J1772'], batteryKwh: 91, rangeKm: 380, maxChargeKw: 200 },

  // Nissan
  { id: 'nissan-ariya', make: 'Nissan', model: 'Ariya', year: '2023+', plugTypes: ['CCS', 'J1772'], batteryKwh: 87, rangeKm: 480, maxChargeKw: 130 },
  { id: 'nissan-leaf', make: 'Nissan', model: 'Leaf', year: '2018+', plugTypes: ['CHADEMO', 'J1772'], batteryKwh: 62, rangeKm: 340, maxChargeKw: 100 },

  // Polestar
  { id: 'polestar-2', make: 'Polestar', model: '2', year: '2021+', plugTypes: ['CCS', 'J1772'], batteryKwh: 78, rangeKm: 440, maxChargeKw: 205 },

  // Lucid
  { id: 'lucid-air', make: 'Lucid', model: 'Air', year: '2022+', plugTypes: ['CCS', 'J1772'], batteryKwh: 112, rangeKm: 830, maxChargeKw: 300 },

  // Audi
  { id: 'audi-etron-gt', make: 'Audi', model: 'e-tron GT', year: '2022+', plugTypes: ['CCS', 'J1772'], batteryKwh: 93, rangeKm: 380, maxChargeKw: 270 },
  { id: 'audi-q8-etron', make: 'Audi', model: 'Q8 e-tron', year: '2023+', plugTypes: ['CCS', 'J1772'], batteryKwh: 114, rangeKm: 490, maxChargeKw: 170 },

  // Porsche
  { id: 'porsche-taycan', make: 'Porsche', model: 'Taycan', year: '2020+', plugTypes: ['CCS', 'J1772'], batteryKwh: 93, rangeKm: 480, maxChargeKw: 320 },

  // Subaru
  { id: 'subaru-solterra', make: 'Subaru', model: 'Solterra', year: '2023+', plugTypes: ['CCS', 'J1772'], batteryKwh: 71, rangeKm: 350, maxChargeKw: 150 },

  // Toyota
  { id: 'toyota-bz4x', make: 'Toyota', model: 'bZ4X', year: '2023+', plugTypes: ['CCS', 'J1772'], batteryKwh: 71, rangeKm: 400, maxChargeKw: 150 },

  // Cadillac
  { id: 'cadillac-lyriq', make: 'Cadillac', model: 'Lyriq', year: '2023+', plugTypes: ['CCS', 'J1772'], batteryKwh: 102, rangeKm: 500, maxChargeKw: 190 },

  // Genesis
  { id: 'genesis-gv60', make: 'Genesis', model: 'GV60', year: '2023+', plugTypes: ['CCS', 'J1772'], batteryKwh: 77, rangeKm: 400, maxChargeKw: 350 },
];

// Group vehicles by make for the selector
export function getVehiclesByMake(): Map<string, EVVehicle[]> {
  const byMake = new Map<string, EVVehicle[]>();
  for (const v of EV_VEHICLES) {
    const list = byMake.get(v.make) || [];
    list.push(v);
    byMake.set(v.make, list);
  }
  return byMake;
}
