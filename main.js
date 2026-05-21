"use strict";

/*
 * Created with @iobroker/create-adapter v2.1.1
 */

const utils = require("@iobroker/adapter-core");
const https = require("node:https");
const crypto = require("node:crypto");

class Foxesscloud extends utils.Adapter {
	/**
	 * @param {Partial<utils.AdapterOptions>} [options] - Adapter options
	 */
	constructor(options) {
		super({
			...options,
			name: "foxesscloud",
		});
		this.on("ready", this.onReady.bind(this));
		this.on("unload", this.onUnload.bind(this));

		this.updateInterval = null;
		this.systemLanguage = "en";
		this.lastTempWarningLevel = 0;

		// PV Power JSON tracking
		this.pvPowerJsonData = {
			daily: [],
			weekly: [],
			monthly: [],
		};
		this.currentDayTotal = 0;
		this.currentWeekTotal = 0;
		this.currentMonthTotal = 0;
		this.lastUpdateDate = null;
		this.lastUpdateWeek = null;
		this.lastUpdateMonth = null;
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		// Initialize your adapter here

		// Reset the connection indicator during startup
		this.setState("info.connection", false, true);

		// Check configuration
		if (!this.config.token) {
			this.log.error("API Token is not configured!");
			return;
		}

		if (!this.config.sn) {
			this.log.error("Serial Number (SN) is not configured!");
			return;
		}

		try {
			const systemConfig = await this.getForeignObjectAsync("system.config");
			if (systemConfig?.common?.language) {
				this.systemLanguage = systemConfig.common.language;
			}
		} catch (error) {
			this.log.debug(
				`Could not read system language from system.config: ${error instanceof Error ? error.message : String(error)}`,
			);
		}

		// Create states
		await this.createStates();

		// Get interval from config (default 60 seconds, minimum 60 seconds, maximum 2_147_483_647 ms)
		let intervalSeconds = Math.max(60, this.config.interval || 60);
		const maxIntervalSeconds = Math.floor(2_147_483_647 / 1000); // ~24,8 Tage
		if (intervalSeconds * 1000 > 2_147_483_647) {
			this.log.warn(
				`Configured interval (${intervalSeconds}s) is too high and will be limited to ${maxIntervalSeconds}s (max allowed by Node.js).`,
			);
			intervalSeconds = maxIntervalSeconds;
		}
		this.log.info(`Update interval set to ${intervalSeconds} seconds`);

		// Start periodic data retrieval
		this.getData(); // First call immediately
		this.updateInterval = this.setInterval(() => {
			this.getData();
		}, intervalSeconds * 1000);
	}

	/**
	 * Create all necessary states
	 */
	async createStates() {
		await this.setObjectNotExistsAsync("pvPower", {
			type: "state",
			common: {
				name: {
					en: "PV Power",
					de: "PV-Leistung",
					ru: "Нагрузка на мощность",
					pt: "Potência de carga",
					nl: "Belastingsvermogen",
					fr: "Puissance de charge",
					it: "Potenza di carico",
					es: "Potencia de carga",
					pl: "Moc obciążenia",
					uk: "Потужність навантаження",
					"zh-cn": "负载功率",
				},
				type: "number",
				role: "value.power",
				unit: "kW",
				read: true,
				write: false,
			},
			native: {},
		});

		await this.setObjectNotExistsAsync("generationPower", {
			type: "state",
			common: {
				name: {
					en: "Generation Power (Output)",
					de: "Erzeugungsleistung (Ausgang)",
					ru: "Вырабатываемая мощность (выходная)",
					pt: "Potência de geração (saída)",
					nl: "Opwekkingsvermogen (output)",
					fr: "Puissance de production (sortie)",
					it: "Potenza di generazione (uscita)",
					es: "Generación de potencia (salida)",
					pl: "Moc generowana (wyjście)",
					uk: "Генерована потужність (вихідна)",
					"zh-cn": "发电功率（输出）",
				},
				type: "number",
				role: "value.power",
				unit: "kW",
				read: true,
				write: false,
			},
			native: {},
		});

		await this.setObjectNotExistsAsync("soc", {
			type: "state",
			common: {
				name: {
					en: "Battery State of Charge",
					de: "Batterie-Ladezustand",
					ru: "Уровень заряда батареи",
					pt: "Estado de carga da bateria",
					nl: "Batterijlaadstatus",
					fr: "État de charge de la batterie",
					it: "Stato di carica della batteria",
					es: "Estado de carga de la batería",
					pl: "Stan naładowania baterii",
					uk: "Стан заряду акумулятора",
					"zh-cn": "电池电量",
				},
				type: "number",
				role: "value.battery",
				unit: "%",
				read: true,
				write: false,
			},
			native: {},
		});

		await this.setObjectNotExistsAsync("load", {
			type: "state",
			common: {
				name: {
					en: "Load Power",
					de: "Verbrauchsleistung",
					ru: "Нагрузка на мощность",
					pt: "Potência de carga",
					nl: "Belastingsvermogen",
					fr: "Puissance de charge",
					it: "Potenza di carico",
					es: "Potencia de carga",
					pl: "Moc obciążenia",
					uk: "Потужність навантаження",
					"zh-cn": "负载功率",
				},
				type: "number",
				role: "value.power",
				unit: "kW",
				read: true,
				write: false,
			},
			native: {},
		});

		await this.setObjectNotExistsAsync("gridConsumption", {
			type: "state",
			common: {
				name: {
					en: "Grid Consumption Power (Importing)",
					de: "Netzbezugsleistung (Import)",
					ru: "Потребление электроэнергии из сети (импорт)",
					pt: "Consumo de energia da rede (importação)",
					nl: "Stroomverbruik via het net (import)",
					fr: "Consommation électrique du réseau (importation)",
					it: "Consumo di energia dalla rete (importazione)",
					es: "Consumo de energía de la red (importación)",
					pl: "Zużycie energii w sieci (import)",
					uk: "Споживання електроенергії з мережі (імпорт)",
					"zh-cn": "电网消耗功率（进口）",
				},
				type: "number",
				role: "value.power",
				unit: "kW",
				read: true,
				write: false,
			},
			native: {},
		});

		await this.setObjectNotExistsAsync("feedinPower", {
			type: "state",
			common: {
				name: {
					en: "Feed-in Power (Exporting)",
					de: "Einspeiseleistung (Export)",
					ru: "Поставка электроэнергии в сеть (экспорт)",
					pt: "Energia de injeção na rede (exportação)",
					nl: "Teruglevering van elektriciteit (export)",
					fr: "Puissance injectée (exportation)",
					it: "Energia immessa (esportazione)",
					es: "Energía de alimentación (exportación)",
					pl: "Moc dostarczona (eksport)",
					uk: "Потужність живлення (експорт)",
					"zh-cn": "并网电力（出口）",
				},
				type: "number",
				role: "value.power",
				unit: "kW",
				read: true,
				write: false,
			},
			native: {},
		});

		await this.setObjectNotExistsAsync("batCharge", {
			type: "state",
			common: {
				name: {
					en: "Battery Charge Power",
					de: "Batterie-Ladeleistung",
					ru: "Зарядка аккумулятора",
					pt: "Energia de carregamento da bateria",
					nl: "Batterijlaadvermogen",
					fr: "Puissance de charge de la batterie",
					it: "Potenza di carica della batteria",
					es: "Potencia de carga de la batería",
					pl: "Moc ładowania akumulatora",
					uk: "Потужність заряду акумулятора",
					"zh-cn": "电池充电功率",
				},
				type: "number",
				role: "value.power",
				unit: "kW",
				read: true,
				write: false,
			},
			native: {},
		});

		await this.setObjectNotExistsAsync("batDischarge", {
			type: "state",
			common: {
				name: {
					en: "Battery Discharge Power",
					de: "Batterie-Entladeleistung",
					ru: "Мощность разряда батареи",
					pt: "Potência de descarga da bateria",
					nl: "Batterijontladingsvermogen",
					fr: "Puissance de décharge de la batterie",
					it: "Potenza di scarica della batteria",
					es: "Potencia de descarga de la batería",
					pl: "Moc rozładowania akumulatora",
					uk: "Потужність розряду акумулятора",
					"zh-cn": "电池放电功率",
				},
				type: "number",
				role: "value.power",
				unit: "kW",
				read: true,
				write: false,
			},
			native: {},
		});

		await this.setObjectNotExistsAsync("invTemperature", {
			type: "state",
			common: {
				name: {
					en: "Inverter Internal Temperature",
					de: "Interne Wechselrichtertemperatur",
					ru: "Внутренняя температура инвертора",
					pt: "Temperatura interna do inversor",
					nl: "Interne omvormertemperatuur",
					fr: "Temperature interne de l'onduleur",
					it: "Temperatura interna dell'inverter",
					es: "Temperatura interna del inversor",
					pl: "Wewnętrzna temperatura falownika",
					uk: "Внутрішня температура інвертора",
					"zh-cn": "逆变器内部温度",
				},
				type: "number",
				role: "value.temperature",
				unit: "°C",
				read: true,
				write: false,
			},
			native: {},
		});

		await this.setObjectNotExistsAsync("runningState", {
			type: "state",
			common: {
				name: {
					en: "Running State",
					de: "Betriebszustand",
					ru: "Рабочее состояние",
					pt: "Estado de funcionamento",
					nl: "Bedrijfsstatus",
					fr: "État de fonctionnement",
					it: "Stato operativo",
					es: "Estado de funcionamiento",
					pl: "Stan pracy",
					uk: "Робочий стан",
					"zh-cn": "运行状态",
				},
				type: "string",
				role: "text",
				read: true,
				write: false,
			},
			native: {},
		});

		await this.setObjectNotExistsAsync("batTemperature", {
			type: "state",
			common: {
				name: {
					en: "Battery Temperature",
					de: "Batterietemperatur",
					ru: "Температура батареи",
					pt: "Temperatura da bateria",
					nl: "Batterijtemperatuur",
					fr: "Température de la batterie",
					it: "Temperatura della batteria",
					es: "Temperatura de la batería",
					pl: "Temperatura akumulatora",
					uk: "Температура акумулятора",
					"zh-cn": "电池温度",
				},
				type: "number",
				role: "value.temperature",
				unit: "°C",
				read: true,
				write: false,
			},
			native: {},
		});

		await this.setObjectNotExistsAsync("pv1Power", {
			type: "state",
			common: {
				name: {
					en: "PV String 1 Power",
					de: "PV-String 1 Leistung",
					ru: "Мощность PV-строки 1",
					pt: "Potência do string PV 1",
					nl: "PV-string 1 vermogen",
					fr: "Puissance chaîne PV 1",
					it: "Potenza stringa PV 1",
					es: "Potencia cadena FV 1",
					pl: "Moc łańcucha PV 1",
					uk: "Потужність рядка PV 1",
					"zh-cn": "PV 串列 1 功率",
				},
				type: "number",
				role: "value.power",
				unit: "kW",
				read: true,
				write: false,
			},
			native: {},
		});

		await this.setObjectNotExistsAsync("pv2Power", {
			type: "state",
			common: {
				name: {
					en: "PV String 2 Power",
					de: "PV-String 2 Leistung",
					ru: "Мощность PV-строки 2",
					pt: "Potência do string PV 2",
					nl: "PV-string 2 vermogen",
					fr: "Puissance chaîne PV 2",
					it: "Potenza stringa PV 2",
					es: "Potencia cadena FV 2",
					pl: "Moc łańcucha PV 2",
					uk: "Потужність рядка PV 2",
					"zh-cn": "PV 串列 2 功率",
				},
				type: "number",
				role: "value.power",
				unit: "kW",
				read: true,
				write: false,
			},
			native: {},
		});

		// Create JSON states for PV power statistics
		if (this.config.enablePvPowerJSON) {
			if (this.config.pvPowerJSON_daily) {
				await this.setObjectNotExistsAsync("pvPowerJSON.daily", {
					type: "state",
					common: {
						name: {
							en: "Daily PV Power Statistics (JSON)",
							de: "Tägliche PV-Leistungsstatistiken (JSON)",
						},
						type: "string",
						role: "json",
						read: true,
						write: false,
					},
					native: {},
				});
			}

			if (this.config.pvPowerJSON_weekly) {
				await this.setObjectNotExistsAsync("pvPowerJSON.weekly", {
					type: "state",
					common: {
						name: {
							en: "Weekly PV Power Statistics (JSON)",
							de: "Wöchentliche PV-Leistungsstatistiken (JSON)",
						},
						type: "string",
						role: "json",
						read: true,
						write: false,
					},
					native: {},
				});
			}

			if (this.config.pvPowerJSON_monthly) {
				await this.setObjectNotExistsAsync("pvPowerJSON.monthly", {
					type: "state",
					common: {
						name: {
							en: "Monthly PV Power Statistics (JSON)",
							de: "Monatliche PV-Leistungsstatistiken (JSON)",
						},
						type: "string",
						role: "json",
						read: true,
						write: false,
					},
					native: {},
				});
			}

			// Internal state to persist running totals across adapter restarts
			await this.setObjectNotExistsAsync("pvPowerJSON._runningState", {
				type: "state",
				common: {
					name: {
						en: "PV Power Statistics Running State (internal)",
						de: "PV-Statistiken Laufzustand (intern)",
					},
					type: "string",
					role: "json",
					read: true,
					write: false,
				},
				native: {},
			});

			await this.restorePvPowerJsonState();
		}
	}

	/**
	 * Get data from FoxESS Cloud API
	 */
	async getData() {
		try {
			const data = JSON.stringify({
				sn: this.config.sn,
				variables: [
					"pvPower",
					"pv1Power",
					"pv2Power",
					"generationPower",
					"SoC",
					"loadsPower",
					"gridConsumptionPower",
					"feedinPower",
					"batChargePower",
					"batDischargePower",
					"batTemperature_1",
					"batTemperature",
					"invTemperation",
					"runningState",
				],
			});

			const path = "/op/v0/device/real/query";
			const milliseconds = new Date().getTime();

			// WICHTIG: Die Signatur verwendet buchstäbliche Zeichen "\\r\\n", NICHT echte Zeilenumbrüche!
			const signatureString = `${path}\\r\\n${this.config.token}\\r\\n${milliseconds}`;
			const signature = crypto.createHash("md5").update(signatureString).digest("hex");

			const options = {
				headers: {
					"Content-Type": "application/json",
					token: this.config.token,
					timestamp: milliseconds,
					signature: signature,
					lang: "en",
				},
				hostname: "www.foxesscloud.com",
				method: "POST",
				path: path,
				port: 443,
			};

			const request = https.request(options, response => {
				response.setEncoding("utf8");

				let responseData = "";

				response.on("data", chunk => {
					responseData += chunk;
				});

				response.on("end", () => {
					try {
						if (!responseData) {
							this.log.error("No data received from API");
							this.setState("info.connection", false, true);
							return;
						}

						const json = JSON.parse(responseData);

						// Check if API response is valid
						if (!json.result || !json.result[0] || !json.result[0].datas) {
							this.log.error("Invalid API response - missing result/datas structure");
							this.log.error(`API response: ${JSON.stringify(json, null, 2)}`);
							if (json.errno !== undefined) {
								this.log.error(`API error code: ${json.errno}`);
							}
							if (json.msg !== undefined) {
								this.log.error(`API error message: ${json.msg}`);
							}
							this.setState("info.connection", false, true);
							return;
						}

						const datas = json.result[0].datas;

						// Update connection state
						this.setState("info.connection", true, true);

						// Update all states
						// @ts-expect-error FoxESS response data is dynamically typed.
						const getDataPointByVariable = variable =>
							// @ts-expect-error FoxESS response data entries are dynamically typed.
							datas.find(entry => entry && entry.variable === variable);

						const pvPowerData = getDataPointByVariable("pvPower");
						if (pvPowerData && pvPowerData.value !== undefined) {
							const pvPower = parseFloat(pvPowerData.value.toFixed(3));
							this.setState("pvPower", pvPower, true);

							// Update PV Power JSON statistics (fire and forget)
							this.updatePvPowerJson(pvPower).catch(err => {
								this.log.debug(
									`Error updating PV Power JSON: ${err instanceof Error ? err.message : String(err)}`,
								);
							});
						}

						const generationPowerData = getDataPointByVariable("generationPower");
						if (generationPowerData && generationPowerData.value !== undefined) {
							const genPower = parseFloat(generationPowerData.value.toFixed(3));
							this.setState("generationPower", genPower, true);
						}

						const socData = getDataPointByVariable("SoC") || getDataPointByVariable("SoC_1");
						if (socData && socData.value !== undefined) {
							const soc = socData.value;
							this.setState("soc", soc, true);
						}

						const loadsPowerData = getDataPointByVariable("loadsPower");
						if (loadsPowerData && loadsPowerData.value !== undefined) {
							const load = parseFloat(loadsPowerData.value.toFixed(3));
							this.setState("load", load, true);
						}

						const gridConsumptionData = getDataPointByVariable("gridConsumptionPower");
						if (gridConsumptionData && gridConsumptionData.value !== undefined) {
							const gridCons = parseFloat(gridConsumptionData.value.toFixed(3));
							this.setState("gridConsumption", gridCons, true);
						}

						const feedinPowerData = getDataPointByVariable("feedinPower");
						if (feedinPowerData && feedinPowerData.value !== undefined) {
							const feedin = parseFloat(feedinPowerData.value.toFixed(3));
							this.setState("feedinPower", feedin, true);
						}

						const batChargePowerData = getDataPointByVariable("batChargePower");
						if (batChargePowerData && batChargePowerData.value !== undefined) {
							const charge = parseFloat(batChargePowerData.value.toFixed(3));
							this.setState("batCharge", charge, true);
						}

						const batDischargePowerData = getDataPointByVariable("batDischargePower");
						if (batDischargePowerData && batDischargePowerData.value !== undefined) {
							const discharge = parseFloat(batDischargePowerData.value.toFixed(3));
							this.setState("batDischarge", discharge, true);
						}

						const invTemperatureData = getDataPointByVariable("invTemperation");
						if (invTemperatureData && invTemperatureData.value !== undefined) {
							const invTemperature = parseFloat(invTemperatureData.value.toFixed(1));
							this.setState("invTemperature", invTemperature, true);

							if (invTemperature >= 80) {
								if (this.lastTempWarningLevel !== 80) {
									if (this.systemLanguage === "de") {
										this.log.warn(
											`Achtung, Wechselrichtertemperatur zu hoch: ${invTemperature.toFixed(1)} °C.`,
										);
									} else {
										this.log.warn(
											`Warning, inverter temperature is too high: ${invTemperature.toFixed(1)} °C.`,
										);
									}
								}
								this.lastTempWarningLevel = 80;
							} else if (invTemperature >= 65) {
								if (this.lastTempWarningLevel === 0) {
									if (this.systemLanguage === "de") {
										this.log.warn(
											`Kritisch, bitte die Wechselrichtertemperatur im Blick behalten: ${invTemperature.toFixed(1)} °C.`,
										);
									} else {
										this.log.warn(
											`Critical, please keep an eye on inverter temperature: ${invTemperature.toFixed(1)} °C.`,
										);
									}
								}
								this.lastTempWarningLevel = 65;
							} else if (invTemperature < 63) {
								// Reset warning level below threshold minus hysteresis to avoid log spam.
								this.lastTempWarningLevel = 0;
							}
						}

						const pv1PowerData = getDataPointByVariable("pv1Power");
						if (pv1PowerData && pv1PowerData.value !== undefined) {
							const pv1 = parseFloat(pv1PowerData.value.toFixed(3));
							this.setState("pv1Power", pv1, true);
						}

						const pv2PowerData = getDataPointByVariable("pv2Power");
						if (pv2PowerData && pv2PowerData.value !== undefined) {
							const pv2 = parseFloat(pv2PowerData.value.toFixed(3));
							this.setState("pv2Power", pv2, true);
						}

						const batTemperatureData =
							getDataPointByVariable("batTemperature_1") || getDataPointByVariable("batTemperature");
						if (
							batTemperatureData &&
							batTemperatureData.value !== undefined &&
							batTemperatureData.value !== null
						) {
							const batTemp = parseFloat(batTemperatureData.value.toFixed(1));
							this.setState("batTemperature", batTemp, true);
						}

						const runningStateData = getDataPointByVariable("runningState");
						if (runningStateData && runningStateData.value !== undefined) {
							this.setState("runningState", String(runningStateData.value), true);
						}

						this.log.debug("Data successfully updated");
					} catch (parseError) {
						this.log.error(
							`Error processing API response: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
						);
						this.log.error(`Raw data: ${responseData}`);
						this.setState("info.connection", false, true);
					}
				});

				response.on("error", err => {
					this.log.error(`Response error: ${err.message}`);
					this.setState("info.connection", false, true);
				});
			});

			request.on("error", err => {
				this.log.error(`Request error: ${err.message}`);
				this.setState("info.connection", false, true);
			});

			request.write(data);
			request.end();
		} catch (e) {
			this.log.error(`Exception error: ${e instanceof Error ? e.message : String(e)}`);
			if (e instanceof Error && e.stack) {
				this.log.error(e.stack);
			}
			this.setState("info.connection", false, true);
		}
	}

	/**
	 * Restore running totals and historical data from the persisted ioBroker state.
	 * Falls back to configured start values if no persisted state exists yet.
	 */
	async restorePvPowerJsonState() {
		const state = await this.getStateAsync("pvPowerJSON._runningState");
		if (state && state.val) {
			try {
				const saved = JSON.parse(state.val);
				this.currentDayTotal = saved.currentDayTotal ?? 0;
				this.currentWeekTotal = saved.currentWeekTotal ?? 0;
				this.currentMonthTotal = saved.currentMonthTotal ?? 0;
				this.lastUpdateDate = saved.lastUpdateDate ?? null;
				this.lastUpdateWeek = saved.lastUpdateWeek ?? null;
				this.lastUpdateMonth = saved.lastUpdateMonth ?? null;
				if (saved.pvPowerJsonData) {
					this.pvPowerJsonData = saved.pvPowerJsonData;
				}
				this.log.debug("PV power statistics restored from persisted state.");
			} catch (e) {
				this.log.warn(
					`Failed to restore PV power statistics state: ${e instanceof Error ? e.message : String(e)}`,
				);
			}
		} else {
			this.log.debug("No persisted PV power statistics found – starting fresh.");
		}
	}

	/**
	 * Persist running totals and historical data to an ioBroker state so they
	 * survive adapter restarts.
	 */
	async savePvPowerJsonState() {
		const payload = JSON.stringify({
			currentDayTotal: this.currentDayTotal,
			currentWeekTotal: this.currentWeekTotal,
			currentMonthTotal: this.currentMonthTotal,
			lastUpdateDate: this.lastUpdateDate,
			lastUpdateWeek: this.lastUpdateWeek,
			lastUpdateMonth: this.lastUpdateMonth,
			pvPowerJsonData: this.pvPowerJsonData,
		});
		await this.setStateAsync("pvPowerJSON._runningState", payload, true);
	}

	/**
	 * Track PV power data and update JSON statistics
	 *
	 * @param {number} pvPower - Current PV power in kW
	 */
	async updatePvPowerJson(pvPower) {
		if (!this.config.enablePvPowerJSON) {
			return;
		}

		const now = new Date();
		const dayKey = this.getDateKey(now);
		const weekKey = this.getWeekKey(now);
		const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`; // YYYY-MM

		// Check if date changed and rotate data
		if (this.lastUpdateDate !== dayKey) {
			if (this.lastUpdateDate !== null && this.currentDayTotal > 0) {
				this.rotateDailyData(this.lastUpdateDate, this.currentDayTotal);
			}
			// Use configured start value only on first run (null), not on every day rollover
			this.currentDayTotal =
				this.lastUpdateDate === null ? this.getConfiguredStartValue(this.config.pvPowerJSONStartDaily) : 0;
			this.lastUpdateDate = dayKey;
		}

		if (this.lastUpdateWeek !== weekKey) {
			if (this.lastUpdateWeek !== null && this.currentWeekTotal > 0) {
				this.rotateWeeklyData(this.lastUpdateWeek, this.currentWeekTotal);
			}
			// Use configured start value only on first run (null), not on every week rollover
			this.currentWeekTotal =
				this.lastUpdateWeek === null ? this.getConfiguredStartValue(this.config.pvPowerJSONStartWeekly) : 0;
			this.lastUpdateWeek = weekKey;
		}

		if (this.lastUpdateMonth !== monthKey) {
			if (this.lastUpdateMonth !== null && this.currentMonthTotal > 0) {
				this.rotateMonthlyData(this.lastUpdateMonth, this.currentMonthTotal);
			}
			// Use configured start value only on first run (null), not on every month rollover
			this.currentMonthTotal =
				this.lastUpdateMonth === null ? this.getConfiguredStartValue(this.config.pvPowerJSONStartMonthly) : 0;
			this.lastUpdateMonth = monthKey;
		}

		// Add PV power to current totals (convert power to energy: kW * seconds / 3600)
		const energyPerInterval = (pvPower * (this.config.interval || 60)) / 3600; // kWh
		this.currentDayTotal += energyPerInterval;
		this.currentWeekTotal += energyPerInterval;
		this.currentMonthTotal += energyPerInterval;

		// Update JSON states
		if (this.config.pvPowerJSON_daily) {
			await this.generateAndUpdateDailyJson();
		}
		if (this.config.pvPowerJSON_weekly) {
			await this.generateAndUpdateWeeklyJson();
		}
		if (this.config.pvPowerJSON_monthly) {
			await this.generateAndUpdateMonthlyJson();
		}

		// Persist running totals so they survive adapter restarts
		await this.savePvPowerJsonState();
	}

	/**
	 * Normalize an optional numeric config value.
	 *
	 * @param {unknown} value - Config value
	 * @returns {number} Parsed number or 0
	 */
	getConfiguredStartValue(value) {
		const parsedValue = Number(value);
		return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 0;
	}

	/**
	 * Get a local calendar date key in format YYYY-MM-DD.
	 *
	 * @param {Date} date - Date object
	 * @returns {string} Date key
	 */
	getDateKey(date) {
		return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
	}

	/**
	 * Get localized weekday name.
	 *
	 * @param {Date} date - Date object
	 * @returns {string} Localized weekday name
	 */
	getDayName(date) {
		const dayNames = {
			en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
			de: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"],
		};
		const lang = this.systemLanguage === "de" ? "de" : "en";
		return dayNames[lang][date.getDay()];
	}

	/**
	 * Get localized month name.
	 *
	 * @param {number} monthIndex - Month index from 0-11
	 * @returns {string} Localized month name
	 */
	getMonthName(monthIndex) {
		const monthNames = {
			en: [
				"January",
				"February",
				"March",
				"April",
				"May",
				"June",
				"July",
				"August",
				"September",
				"October",
				"November",
				"December",
			],
			de: [
				"Januar",
				"Februar",
				"März",
				"April",
				"Mai",
				"Juni",
				"Juli",
				"August",
				"September",
				"Oktober",
				"November",
				"Dezember",
			],
		};
		const lang = this.systemLanguage === "de" ? "de" : "en";
		return monthNames[lang][monthIndex];
	}

	/**
	 * Create a statistics entry.
	 *
	 * @param {string} key - Internal period key
	 * @param {string} label - Output label
	 * @param {number} totalEnergy - Total energy in kWh
	 * @returns {{key: string, date: string, value: string, price?: string}} Statistics entry
	 */
	createStatisticsEntry(key, label, totalEnergy) {
		const entry = {
			key: key,
			date: label,
			value: parseFloat(totalEnergy.toFixed(3)).toString(),
		};

		if (this.config.kwhPrice && this.config.kwhPrice > 0) {
			entry.price = parseFloat((totalEnergy * this.config.kwhPrice).toFixed(2)).toString();
		}

		return entry;
	}

	/**
	 * Get all dates for the current ISO week from Monday to Sunday.
	 *
	 * @param {Date} date - Reference date
	 * @returns {string[]} Date keys in format YYYY-MM-DD
	 */
	getWeekDateKeys(date) {
		const referenceDate = new Date(date);
		referenceDate.setHours(0, 0, 0, 0);
		const isoDay = referenceDate.getDay() || 7;
		referenceDate.setDate(referenceDate.getDate() - isoDay + 1);

		const dateKeys = [];
		for (let offset = 0; offset < 7; offset++) {
			const currentDate = new Date(referenceDate);
			currentDate.setDate(referenceDate.getDate() + offset);
			dateKeys.push(this.getDateKey(currentDate));
		}

		return dateKeys;
	}

	/**
	 * Get the current and previous ISO week keys.
	 *
	 * @param {Date} date - Reference date
	 * @param {number} count - Number of weeks to return
	 * @returns {string[]} Week keys in chronological order
	 */
	getRecentWeekKeys(date, count) {
		const referenceDate = new Date(date);
		referenceDate.setHours(0, 0, 0, 0);
		const isoDay = referenceDate.getDay() || 7;
		referenceDate.setDate(referenceDate.getDate() - isoDay + 1);

		const weekKeys = [];
		for (let offset = count - 1; offset >= 0; offset--) {
			const currentWeekDate = new Date(referenceDate);
			currentWeekDate.setDate(referenceDate.getDate() - offset * 7);
			weekKeys.push(this.getWeekKey(currentWeekDate));
		}

		return weekKeys;
	}

	/**
	 * Get all ISO week keys for the current month.
	 * Returns all weeks that contain at least one day in the current month.
	 *
	 * @param {Date} date - Reference date
	 * @returns {string[]} Week keys for current month in chronological order
	 */
	getMonthWeekKeys(date) {
		const d = new Date(date);
		d.setHours(0, 0, 0, 0);

		const year = d.getFullYear();
		const month = d.getMonth();

		// Get first day of current month
		const firstDay = new Date(year, month, 1);
		// Get last day of current month
		const lastDay = new Date(year, month + 1, 0);

		const weekKeys = new Set();
		const currentDate = new Date(firstDay);

		// Collect all week keys that contain days in the current month
		while (currentDate <= lastDay) {
			weekKeys.add(this.getWeekKey(currentDate));
			currentDate.setDate(currentDate.getDate() + 1);
		}

		// Sort and return as array
		return Array.from(weekKeys).sort();
	}

	/**
	 * Get week key in format YYYY-Www (ISO week)
	 *
	 * @param {Date} date - Date object
	 * @returns {string} Week key
	 */
	getWeekKey(date) {
		const d = new Date(date);
		d.setHours(0, 0, 0, 0);
		d.setDate(d.getDate() + 4 - (d.getDay() || 7));
		const yearStart = new Date(d.getFullYear(), 0, 1);
		const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
		return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
	}

	/**
	 * Store daily data in history
	 *
	 * @param {string} dateKey - Date key YYYY-MM-DD
	 * @param {number} totalEnergy - Total energy in kWh
	 */
	rotateDailyData(dateKey, totalEnergy) {
		const dateObj = new Date(dateKey);
		const entry = this.createStatisticsEntry(dateKey, this.getDayName(dateObj), totalEnergy);

		// Keep only 7 days (current ISO week)
		this.pvPowerJsonData.daily.push(entry);
		if (this.pvPowerJsonData.daily.length > 7) {
			this.pvPowerJsonData.daily.shift();
		}
	}

	/**
	 * Store weekly data in history
	 *
	 * @param {string} weekKey - Week key YYYY-Www
	 * @param {number} totalEnergy - Total energy in kWh
	 */
	rotateWeeklyData(weekKey, totalEnergy) {
		const entry = this.createStatisticsEntry(weekKey, `KW ${weekKey.split("-W")[1]}`, totalEnergy);

		// Keep only last 5 weeks (current month)
		this.pvPowerJsonData.weekly.push(entry);
		if (this.pvPowerJsonData.weekly.length > 5) {
			this.pvPowerJsonData.weekly.shift();
		}
	}

	/**
	 * Store monthly data in history
	 *
	 * @param {string} monthKey - Month key YYYY-MM
	 * @param {number} totalEnergy - Total energy in kWh
	 */
	rotateMonthlyData(monthKey, totalEnergy) {
		const [, month] = monthKey.split("-").map(Number);
		const monthName = this.getMonthName(month - 1);
		const entry = this.createStatisticsEntry(monthKey, monthName, totalEnergy);

		// Find and update or add month
		const existingIndex = this.pvPowerJsonData.monthly.findIndex(e => e.key === monthKey);
		if (existingIndex >= 0) {
			this.pvPowerJsonData.monthly[existingIndex] = entry;
		} else {
			this.pvPowerJsonData.monthly.push(entry);
		}
	}

	/**
	 * Generate and update daily JSON state
	 */
	async generateAndUpdateDailyJson() {
		const todayKey = this.getDateKey(new Date());
		const data = this.getWeekDateKeys(new Date()).map(dateKey => {
			if (dateKey > todayKey) {
				return this.createStatisticsEntry(dateKey, this.getDayName(new Date(`${dateKey}T00:00:00`)), 0);
			}

			if (dateKey === this.lastUpdateDate) {
				return this.createStatisticsEntry(
					dateKey,
					this.getDayName(new Date(`${dateKey}T00:00:00`)),
					this.currentDayTotal,
				);
			}

			const existingEntry = this.pvPowerJsonData.daily.find(entry => entry.key === dateKey);
			if (existingEntry) {
				return existingEntry;
			}

			return this.createStatisticsEntry(dateKey, this.getDayName(new Date(`${dateKey}T00:00:00`)), 0);
		});

		// Calculate total
		let totalValue = 0;
		let totalPrice = 0;
		for (const entry of data) {
			totalValue += parseFloat(entry.value);
			if (entry.price) {
				totalPrice += parseFloat(entry.price);
			}
		}

		const sumEntry = {
			date: this.systemLanguage === "de" ? "Summe" : "Total",
			value: parseFloat(totalValue.toFixed(3)).toString(),
		};
		if (this.config.kwhPrice && this.config.kwhPrice > 0) {
			sumEntry.price = parseFloat(totalPrice.toFixed(2)).toString();
		}

		await this.setState(
			"pvPowerJSON.daily",
			JSON.stringify([...data, sumEntry].map(({ key, ...entry }) => entry)),
			true,
		);
	}

	/**
	 * Generate and update weekly JSON state
	 */
	async generateAndUpdateWeeklyJson() {
		const data = this.getMonthWeekKeys(new Date()).map(weekKey => {
			if (weekKey === this.lastUpdateWeek) {
				return this.createStatisticsEntry(weekKey, `KW ${weekKey.split("-W")[1]}`, this.currentWeekTotal);
			}

			const existingEntry = this.pvPowerJsonData.weekly.find(entry => entry.key === weekKey);
			if (existingEntry) {
				return existingEntry;
			}

			return this.createStatisticsEntry(weekKey, `KW ${weekKey.split("-W")[1]}`, 0);
		});

		// Calculate total
		let totalValue = 0;
		let totalPrice = 0;
		for (const entry of data) {
			totalValue += parseFloat(entry.value);
			if (entry.price) {
				totalPrice += parseFloat(entry.price);
			}
		}

		const sumEntry = {
			date: this.systemLanguage === "de" ? "Summe" : "Total",
			value: parseFloat(totalValue.toFixed(3)).toString(),
		};
		if (this.config.kwhPrice && this.config.kwhPrice > 0) {
			sumEntry.price = parseFloat(totalPrice.toFixed(2)).toString();
		}

		await this.setState(
			"pvPowerJSON.weekly",
			JSON.stringify([...data, sumEntry].map(({ key, ...entry }) => entry)),
			true,
		);
	}

	/**
	 * Generate and update monthly JSON state
	 */
	async generateAndUpdateMonthlyJson() {
		const data = [];
		const currentYear = new Date().getFullYear();
		for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
			const monthKey = `${currentYear}-${String(monthIndex + 1).padStart(2, "0")}`;
			if (monthKey === this.lastUpdateMonth) {
				data.push(this.createStatisticsEntry(monthKey, this.getMonthName(monthIndex), this.currentMonthTotal));
				continue;
			}

			const entry = this.pvPowerJsonData.monthly.find(e => e.key === monthKey);
			if (entry) {
				data.push(entry);
			} else {
				data.push(this.createStatisticsEntry(monthKey, this.getMonthName(monthIndex), 0));
			}
		}

		// Calculate total
		let totalValue = 0;
		let totalPrice = 0;
		for (const entry of data) {
			totalValue += parseFloat(entry.value);
			if (entry.price) {
				totalPrice += parseFloat(entry.price);
			}
		}

		const sumEntry = {
			date: this.systemLanguage === "de" ? "Summe" : "Total",
			value: parseFloat(totalValue.toFixed(3)).toString(),
		};
		if (this.config.kwhPrice && this.config.kwhPrice > 0) {
			sumEntry.price = parseFloat(totalPrice.toFixed(2)).toString();
		}

		await this.setState(
			"pvPowerJSON.monthly",
			JSON.stringify([...data, sumEntry].map(({ key, ...entry }) => entry)),
			true,
		);
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 *
	 * @param {() => void} callback - Callback function to call when cleanup is complete
	 */
	onUnload(callback) {
		try {
			// Clear interval
			if (this.updateInterval) {
				this.clearInterval(this.updateInterval);
				this.updateInterval = null;
			}

			callback();
		} catch {
			callback();
		}
	}
}

if (require.main !== module) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options] - Adapter options
	 */
	module.exports = options => new Foxesscloud(options);
} else {
	// otherwise start the instance directly
	new Foxesscloud();
}
