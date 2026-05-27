# Available FoxESS Cloud API Data Points

This document lists all data points available from the FoxESS Cloud API based on a real device response.

## Currently Implemented States

### Real-time Power States (always created)

| State ID | Description | Unit |
|----------|-------------|------|
| `pvPower` | PV Power | kW |
| `generationPower` | Generation Power (Output) | kW |
| `soc` | Battery State of Charge | % |
| `load` | Load Power | kW |
| `gridConsumption` | Grid Consumption Power (Importing) | kW |
| `feedinPower` | Feed-in Power (Exporting) | kW |
| `batCharge` | Battery Charge Power | kW |
| `batDischarge` | Battery Discharge Power | kW |
| `runningState` | Inverter Running State | - |

### Dynamic States (lazy-created on first non-null value)

| State ID | Description | Unit |
|----------|-------------|------|
| `pv1Power` … `pv24Power` | PV String 1–24 Power (only strings present on the device appear) | kW |
| `invTemperature` | Inverter Internal Temperature | °C |
| `batTemperature` | Battery Temperature | °C |

### Energy Reporting States (optional, if *Enable energy reporting* is enabled)

| State ID | Description | Unit |
|----------|-------------|------|
| `report.day.generation` | Today's PV Generation | kWh |
| `report.day.feedin` | Today's Feed-in Energy | kWh |
| `report.day.gridConsumption` | Today's Grid Consumption | kWh |
| `report.week.generation` | This Week's PV Generation | kWh |
| `report.week.feedin` | This Week's Feed-in Energy | kWh |
| `report.week.gridConsumption` | This Week's Grid Consumption | kWh |
| `report.month.generation` | This Month's PV Generation | kWh |
| `report.month.feedin` | This Month's Feed-in Energy | kWh |
| `report.month.gridConsumption` | This Month's Grid Consumption | kWh |
| `report.year.generation` | This Year's PV Generation | kWh |
| `report.year.feedin` | This Year's Feed-in Energy | kWh |
| `report.year.gridConsumption` | This Year's Grid Consumption | kWh |
| `report._baselines` | Internal baseline data (persisted across restarts) | JSON |

Energy values are derived from the lifetime cumulative values returned by the API. On each period rollover (day/week/month/year) the current lifetime value is stored as a baseline; running totals are the difference between the current lifetime value and that baseline.

### PV Power JSON Statistics States (optional, if *Enable PV Power JSON generation* is enabled)

| State ID | Description | Unit |
|----------|-------------|------|
| `pvPowerJSON.daily` | Daily energy statistics for the current week (Mon–Sun) | JSON |
| `pvPowerJSON.weekly` | Weekly energy statistics for all weeks in the current month | JSON |
| `pvPowerJSON.monthly` | Monthly energy statistics for all 12 months of the current year | JSON |
| `pvPowerJSON._runningState` | Internal running totals (persisted across restarts) | JSON |

## All Available Data Points

### PV (Photovoltaic) Data
| Variable | Name | Unit | Type |
|----------|------|------|------|
| `pvPower` | PVPower | kW | Current |
| `pv1Volt` | PV1Volt | V | Current |
| `pv1Current` | PV1Current | A | Current |
| `pv1Power` | PV1Power | kW | Current |
| `pv2Volt` | PV2Volt | V | Current |
| `pv2Current` | PV2Current | A | Current |
| `pv2Power` | PV2Power | kW | Current |
| `pv3Volt` | PV3Volt | V | Current |
| `pv3Current` | PV3Current | A | Current |
| `pv3Power` | PV3Power | kW | Current |
| `PVEnergyTotal` | Photovoltaic power generation | kWh | Total |

### EPS (Emergency Power Supply) Data
| Variable | Name | Unit | Type |
|----------|------|------|------|
| `epsPower` | EPSPower | kW | Current |
| `epsCurrentR` | EPS-RCurrent | A | Current |
| `epsVoltR` | EPS-RVolt | V | Current |
| `epsPowerR` | EPS-RPower | kW | Current |
| `epsCurrentS` | EPS-SCurrent | A | Current |
| `epsVoltS` | EPS-SVolt | V | Current |
| `epsPowerS` | EPS-SPower | kW | Current |
| `epsCurrentT` | EPS-TCurrent | A | Current |
| `epsVoltT` | EPS-TVolt | V | Current |
| `epsPowerT` | EPS-TPower | kW | Current |

### Grid Phase Data (R/S/T)
| Variable | Name | Unit | Type |
|----------|------|------|------|
| `RCurrent` | RCurrent | A | Current |
| `RVolt` | RVolt | V | Current |
| `RFreq` | RFreq | Hz | Current |
| `RPower` | RPower | kW | Current |
| `SCurrent` | SCurrent | A | Current |
| `SVolt` | SVolt | V | Current |
| `SPower` | SPower | kW | Current |
| `TCurrent` | TCurrent | A | Current |
| `TVolt` | TVolt | V | Current |
| `TPower` | TPower | kW | Current |

### Temperature Data
| Variable | Name | Unit | Type |
|----------|------|------|------|
| `ambientTemperation` | AmbientTemperature | ℃ | Current |
| `invTemperation` | InvTemperation | ℃ | Current |
| `batTemperature_1` | batTemperature | ℃ | Current |

### Load Data
| Variable | Name | Unit | Type |
|----------|------|------|------|
| `loadsPower` | Load Power | kW | Current |
| `loadsPowerR` | LoadsRPower | kW | Current |
| `loadsPowerS` | LoadsSPower | kW | Current |
| `loadsPowerT` | LoadsTPower | kW | Current |
| `loads` | Load power consumption | kWh | Total |

### Generation & Grid Data
| Variable | Name | Unit | Type |
|----------|------|------|------|
| `generationPower` | Output Power | kW | Current |
| `generation` | Cumulative power generation | kWh | Total |
| `feedinPower` | Feed-in Power | kW | Current |
| `feedin` | The total energy of the feeder | kWh | Total |
| `gridConsumptionPower` | GridConsumption Power | kW | Current |
| `gridConsumption` | Total grid electricity consumption | kWh | Total |

### Battery Data
| Variable | Name | Unit | Type |
|----------|------|------|------|
| `invBatVolt` | InvBatVolt | V | Current |
| `invBatCurrent` | InvBatCurrent | A | Current |
| `invBatPower_1` | invBatPower | kW | Current |
| `batChargePower` | Charge Power | kW | Current |
| `batDischargePower` | Discharge Power | kW | Current |
| `batVolt_1` | BatVolt | V | Current |
| `batCurrent_1` | BatCurrent | A | Current |
| `SoC_1` | SoC | % | Current |
| `chargeEnergyToTal` | Total charge energy | kWh | Total |
| `dischargeEnergyToTal` | Total discharge energy | kWh | Total |

### Meter Data
| Variable | Name | Unit | Type |
|----------|------|------|------|
| `meterPower` | MeterPower | kW | Current |
| `meterPower2` | Meter2Power | kW | Current |
| `meterPowerR` | MeterRPower | kW | Current |
| `meterPowerS` | MeterSPower | kW | Current |
| `meterPowerT` | MeterTPower | kW | Current |

### System Status
| Variable | Name | Unit | Type |
|----------|------|------|------|
| `runningState` | Running State | - | String |
| `currentFault` | The current error code is reported | - | String |
| `currentFaultCount` | The number of errors | - | Number |

## Future Implementation

When adding new data points to the adapter:

1. Check this list for available variables
2. Add state definition to `createStates()` in [main.js](../main.js)
3. Add data extraction to `getData()` in [main.js](../main.js)

## API Response Example

See [api-response-example.json](api-response-example.json) for the complete raw API response.

## Notes

- Some variables have a `_1` suffix (e.g., `SoC_1`, `batVolt_1`), likely to support multiple battery systems
- Power values (kW) represent instantaneous measurements
- Energy values (kWh) represent cumulative totals
- The API returns all values regardless of system configuration (e.g., PV3 data even if not connected)
