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
