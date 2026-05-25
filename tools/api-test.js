/**
 * FoxESS Cloud API Test Script
 *
 * Usage:
 *   Option 1: Pass credentials as command-line arguments:
 *     node tools/api-test.js <token> <serial-number>
 *
 *   Option 2: Create a credentials.json file in the tools/ directory:
 *     { "token": "your-api-token", "sn": "your-serial-number" }
 *     Then run: node tools/api-test.js
 */

const https = require("node:https");
const crypto = require("node:crypto");
const fs = require("node:fs");
const nodePath = require("node:path");

// Load credentials from command-line arguments or config file
let token, sn;

if (process.argv.length >= 4) {
	// Option 1: Command-line arguments
	token = process.argv[2];
	sn = process.argv[3];
} else {
	// Option 2: Read from tools/credentials.json
	const credentialsPath = nodePath.join(__dirname, "credentials.json");
	if (fs.existsSync(credentialsPath)) {
		const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf-8"));
		token = credentials.token;
		sn = credentials.sn;
	}
}

if (!token || !sn) {
	throw new Error(
		"Missing credentials!\n" +
			"Option 1: node tools/api-test.js <token> <serial-number>\n" +
			'Option 2: Create tools/credentials.json with { "token": "...", "sn": "..." }',
	);
}

const path = "/op/v0/device/real/query";
const milliseconds = Date.now();
// WICHTIG: Die Signatur verwendet buchstäbliche Zeichen "\\r\\n", NICHT echte Zeilenumbrüche!
const signatureString = `${path}\\r\\n${token}\\r\\n${milliseconds}`;
const signature = crypto.createHash("md5").update(signatureString).digest("hex");

const postData = JSON.stringify({ sn: sn });

const options = {
	hostname: "www.foxesscloud.com",
	port: 443,
	path: path,
	method: "POST",
	headers: {
		"Content-Type": "application/json",
		token: token,
		signature: signature,
		timestamp: milliseconds,
		lang: "en",
		"Content-Length": Buffer.byteLength(postData),
	},
};

console.log("📡 Requesting FoxESS Cloud API...\n");

const req = https.request(options, res => {
	let data = "";
	res.on("data", chunk => (data += chunk));
	res.on("end", () => {
		try {
			const json = JSON.parse(data);
			console.log("✅ API Response:\n");
			console.log(JSON.stringify(json, null, 2));

			// Show available data points
			if (json.result && json.result[0] && json.result[0].datas) {
				console.log("\n📊 Available data points:\n");
				json.result[0].datas.forEach(
					/** @param {{ variable: string, value: unknown, unit?: string, name: string }} d - Data point object */ d => {
						console.log(`   ${d.variable}: ${d.value} ${d.unit || ""} (${d.name})`);
					},
				);
			}
		} catch {
			console.error("❌ Failed to parse response:", data);
		}
	});
});

req.on("error", e => console.error("❌ Request error:", e.message));
req.write(postData);
req.end();
