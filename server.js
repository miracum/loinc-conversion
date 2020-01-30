const fs = require('fs');
const parse = require('csv-parse/lib/sync')
const express = require('express');
var ucum = require('@lhncbc/ucum-lhc');

// Read official loinc database:
console.log("Parsing 'Loinc.csv'...")
try {
	loinc_csv = parse( fs.readFileSync("Loinc.csv", "utf-8"), { columns: true } );
	loinc_units = {};
	for(entry of loinc_csv)
		loinc_units[entry["LOINC_NUM"]] = entry["EXAMPLE_UCUM_UNITS"];
} catch(e) {
	console.log("Could not load 'Loinc.csv'. Did you download the official 'LOINC Table File (CSV)' from 'https://loinc.org/downloads/loinc-table/' and extract 'Loinc.csv'?");
	process.exit(-1);
}

// Read custom synonyms database:
console.log("Parsing 'synonyms.tsv'...")
try {
	synonyms_csv = parse( fs.readFileSync("synonyms.tsv", "utf-8"), { columns: true, delimiter: "\t" } );
	synonyms = {};
	for(entry of synonyms_csv)
		synonyms[entry["NOT_UCUM"]] = entry["UCUM"];
} catch(e) {
	console.log("Could not load 'synonyms.csv'.");
	process.exit(-1);
}

// Read custom conversion database:
console.log("Parsing 'conversion.tsv'...")
try {
	conversion_csv = parse( fs.readFileSync("conversion.tsv", "utf-8"), { columns: true, delimiter: "\t" } );
	conversion_units = {};
	for(entry of conversion_csv)
		conversion_units[entry["FROM_LOINC"]] = entry;
		// Custom conversion units supersede "default LOINC" units:
		loinc_units[entry["TARGET_LOINC"]] = entry["TO_UNIT"];
} catch(e) {
	console.log("Could not load 'conversion.csv'.");
	process.exit(-1);
}

// Create UCUM conversion singleton:
var utils = ucum.UcumLhcUtils.getInstance();

// Start 'express' http server w/ json support:
console.log("Starting server...")
const app = express();
app.use(express.json(options={"limit": "10mb"}));

/*
 REST server
 endpoint: "POST /conversions"
 content-type: application/json
 body: [
	{
		"loinc": "str, e.g. 718-7",
		"unit": "UCUM unit, e.g. g/dL",
		"value": float, optional(=1.0)
	}+
 ]
*/
app.post('/conversions', (request, response) => {

	result = [];

	for(entry of request.body) {
		rs_entry = {};
		if("id" in entry)
			rs_entry["id"] = entry["id"];
		
		try {
			// Value is optional, default to 1.0:
			if(!("value" in entry))
				entry["value"] = 1.0;

			loinc = entry["loinc"];
			unit = entry["unit"];
			value = Number(entry["value"]);
			if(value == null)
				throw "Could not parse value: '" + entry["value"] + "'.";

			// Check if input LOINC exists:
			if(!(loinc in  loinc_units)) 
				throw "Invalid loinc: '" + loinc + "'.";

			// Convert input unit if UCUM synonym exists:
			if(unit in synonyms)
				unit = synonyms[unit];

			// Check if input UCUM unit exists:
			if(utils.validateUnitString(unit).status != "valid")
				throw "Invalid UCUM unit: '" + unit + "'.";

			// Convert according to custom conversion table:
			if(loinc in conversion_units) {
				value = utils.convertUnitTo(unit, value, conversion_units[loinc]["FROM_UNIT"])["toVal"];
				// --> unit = conversion[loinc]["FROM_UNIT"];
				value *= conversion_units[loinc]["FACTOR"];
				unit = conversion_units[loinc]["TO_UNIT"];
				loinc = conversion_units[loinc]["TO_LOINC"];
			}

			// Convert using UCUM lib:
			target_unit = loinc_units[loinc];
			rs_entry["value"] = utils.convertUnitTo(unit, value, target_unit)["toVal"];
			rs_entry["unit"] = target_unit;
			rs_entry["loinc"] = loinc;
		} catch(e) {
			rs_entry["error"] = "Exception during conversion: " + e;
			console.log("Exception during conversion: " + e);
		}

		// Result JSON:
		result.push(rs_entry);
	}

	response.send(result);
});

app.get("/health", async (_req, res) => {
	return res.json({
		status: "healthy",
		description: "application is healthy",
	});
});
  
app.listen(8080, () => {
	console.log(`Server listening on port 8080...`);
});
