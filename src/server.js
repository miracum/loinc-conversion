/* eslint-disable no-restricted-syntax */
const fs = require("fs");
const parse = require("csv-parse/lib/sync");
const express = require("express");
const ucum = require("@lhncbc/ucum-lhc");
const log = require("./config/winston");

const app = express();
app.use(express.json({ limit: "10mb" }));

const loincUnits = {};
const synonyms = {};
const conversionUnits = {};

// Read official loinc database:
log.info("Parsing 'Loinc.csv'...");
try {
  const loincCsv = parse(fs.readFileSync("data/Loinc.csv", "utf-8"), {
    columns: true
  });

  for (const entry of loincCsv) {
    loincUnits[entry.LOINC_NUM] = entry.EXAMPLE_UCUM_UNITS;
  }
} catch (e) {
  log.info(
    "Could not load 'Loinc.csv'. Did you download the official 'LOINC Table File (CSV)' from 'https://loinc.org/downloads/loinc-table/' and extract 'Loinc.csv'?"
  );
  process.exit(-1);
}

// Read custom synonyms database:
log.info("Parsing 'synonyms.tsv'...");
try {
  const synonymsCsv = parse(fs.readFileSync("data/synonyms.tsv", "utf-8"), {
    columns: true,
    delimiter: "\t"
  });

  for (const entry of synonymsCsv) {
    synonyms[entry.NOT_UCUM] = entry.UCUM;
  }
} catch (e) {
  log.info("Could not load 'synonyms.tsv'.", e);
  process.exit(-1);
}

// Read custom conversion database:
log.info("Parsing 'conversion.tsv'...");
try {
  const conversionCsv = parse(fs.readFileSync("data/conversion.tsv", "utf-8"), {
    columns: true,
    delimiter: "\t"
  });

  for (const entry of conversionCsv) {
    conversionUnits[entry.FROM_LOINC] = entry;
    // Custom conversion units supersede "default LOINC" units:
    loincUnits[entry.TARGET_LOINC] = entry.TO_UNIT;
  }
} catch (e) {
  log.info("Could not load 'conversion.csv'.");
  process.exit(-1);
}

// Create UCUM conversion singleton:
const utils = ucum.UcumLhcUtils.getInstance();

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
app.post("/conversions", async (request, response) => {
  const result = [];

  if (!request.body) {
    return response.status(400).send("Empty request body.");
  }

  for (const entry of request.body) {
    const rsEntry = {};
    if ("id" in entry) {
      rsEntry.id = entry.id;
    }

    try {
      // Value is optional, default to 1.0:
      if (!("value" in entry)) {
        entry.value = 1.0;
      }

      let { loinc, unit } = entry;
      let value = Number(entry.value);
      if (value == null) {
        throw new Error("Could not parse value.", { value: entry.value });
      }

      // Check if input LOINC exists:
      if (!(loinc in loincUnits)) {
        throw new Error("Invalid loinc", { code: loinc });
      }

      // Convert input unit if UCUM synonym exists:
      if (unit in synonyms) {
        unit = synonyms[unit];
      }

      // Check if input UCUM unit exists:
      if (utils.validateUnitString(unit).status !== "valid") {
        throw new Error(`Invalid UCUM unit: ${unit}`, { unit });
      }

      // Convert according to custom conversion table:
      if (loinc in conversionUnits) {
        value = utils.convertUnitTo(
          unit,
          value,
          conversionUnits[loinc].FROM_UNIT
        ).toVal;
        // --> unit = conversion[loinc]["FROM_UNIT"];
        value *= conversionUnits[loinc].FACTOR;
        unit = conversionUnits[loinc].TO_UNIT;
        loinc = conversionUnits[loinc].TO_LOINC;
      }

      // Convert using UCUM lib:
      const targetUnit = loincUnits[loinc];
      rsEntry.value = utils.convertUnitTo(unit, value, targetUnit).toVal;
      rsEntry.unit = targetUnit;
      rsEntry.loinc = loinc;
    } catch (e) {
      rsEntry.error = `Exception during conversion: ${e}`;
      log.warn("Exception during conversion", e);
    }

    // Result JSON:
    result.push(rsEntry);
  }

  if (result.some(entry => entry.error)) {
    return response.status(422).send(result);
  }

  return response.send(result);
});

app.get("/health", async (_req, res) => {
  return res.json({
    status: "healthy",
    description: "application is healthy"
  });
});

app.listen(8080, () => {
  log.info("Server listening on port 8080...");
});
