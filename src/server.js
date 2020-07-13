/* eslint-disable no-restricted-syntax */
const fs = require("fs");
const parse = require("csv-parse/lib/sync");
const express = require("express");
const ucum = require("@lhncbc/ucum-lhc");
const log = require("pino")();
const pino = require("pino-http")();

const app = express();
app.use(express.json({ limit: "10mb" }));

if (process.env.LOG_REQUESTS) {
  app.use(pino);
}

const arbUnits = {};
const loincUnits = {};
const synonyms = {};
const conversionUnits = {};

// Read arb'U = arbitrary unit conversions (UCUM [arb'U] requires special
// consideration, as it CANNOT BE CONVERTED):
log.info("Parsing 'arb_U.tsv'...");
try {
  const arbCsv = parse(fs.readFileSync("data/arb_U.tsv", "utf-8"), {
    columns: true,
    delimiter: "\t",
  });

  for (const entry of arbCsv) {
    arbUnits[entry.FROM_UNIT] = entry.TO_UNIT;
  }
} catch (e) {
  log.info("Could not load 'arb_U.tsv'.", e);
  process.exit(-1);
}

// Read official loinc database:
log.info("Parsing 'Loinc.csv'...");
try {
  const loincCsv = parse(fs.readFileSync("data/Loinc.csv", "utf-8"), {
    columns: true,
  });

  for (const entry of loincCsv) {
    // Special handling for [arb'U] = arbitrary unit as it CANNOT BE CONVERTED,
    // use entry from arb_U.tsv:
    if (entry.EXAMPLE_UCUM_UNITS === "[arb'U]") {
      const exUnits = entry.EXAMPLE_UNITS.split(";");
      for (const exUnit of exUnits) {
        if (exUnit in arbUnits) {
          loincUnits[entry.LOINC_NUM] = arbUnits[exUnit];
          break;
        }
      }
      if (!(entry.LOINC_NUM in loincUnits)) {
        loincUnits[entry.LOINC_NUM] = "[arb'U]";
      }
    } else {
      loincUnits[entry.LOINC_NUM] = entry.EXAMPLE_UCUM_UNITS;
    }
  }
} catch (e) {
  log.error(
    "Could not load 'Loinc.csv'. Did you download the official 'LOINC Table File (CSV)' from 'https://loinc.org/downloads/loinc-table/' and extract 'Loinc.csv'?",
    e
  );
  process.exit(-1);
}

// Read custom synonyms database:
log.info("Parsing 'synonyms.tsv'...");
try {
  const synonymsCsv = parse(fs.readFileSync("data/synonyms.tsv", "utf-8"), {
    columns: true,
    delimiter: "\t",
  });

  for (const entry of synonymsCsv) {
    synonyms[entry.NOT_UCUM] = entry.UCUM;
  }
} catch (e) {
  log.error("Could not load 'synonyms.tsv'.", e);
  process.exit(-1);
}

// Read custom conversion database:
log.info("Parsing 'conversion.tsv'...");
try {
  const conversionCsv = parse(fs.readFileSync("data/conversion.tsv", "utf-8"), {
    columns: true,
    delimiter: "\t",
  });

  for (const entry of conversionCsv) {
    conversionUnits[entry.FROM_LOINC] = entry;
    // Custom conversion units supersede "default LOINC" units:
    loincUnits[entry.TARGET_LOINC] = entry.TO_UNIT;
  }
} catch (e) {
  log.error("Could not load 'conversion.csv'.", e);
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
app.post(["/conversions", "/api/v1/conversions"], async (request, response) => {
  let result = [];

  let requestBody = request.body;

  if (
    Object.entries(requestBody).length === 0 &&
    requestBody.constructor === Object
  ) {
    return response.status(400).send({ error: "Empty request body." });
  }

  if (!Array.isArray(request.body)) {
    requestBody = [request.body];
  }

  for (const entry of requestBody) {
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

      if (!loinc) {
        throw new Error("LOINC code is null or empty");
      }

      // Check if input LOINC exists:
      if (!(loinc in loincUnits)) {
        throw new Error(`Invalid LOINC: ${loinc}`, { loinc });
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
      // HACK: arbitrary Unit IU cannot be converted, replace w/ {arbitrary:IU}:
      const targetUnit = loincUnits[loinc];
      const conversion = utils.convertUnitTo(
        unit.replace("[IU]", "{arbitrary:IU}"),
        value,
        targetUnit.replace("[IU]", "{arbitrary:IU}")
      );

      if (conversion.status !== "succeeded") {
        throw new Error(`Cannot convert: ${unit} to ${targetUnit}`, {
          unit,
          targetUnit,
        });
      }

      rsEntry.value = conversion.toVal;
      rsEntry.unit = targetUnit.replace("{arbitrary:IU}", "[IU]");
      rsEntry.loinc = loinc;
    } catch (e) {
      rsEntry.error = `Exception during conversion: ${e}`;
    }

    // Result JSON:
    result.push(rsEntry);
  }

  let status = 200;

  if (result.some((entry) => entry.error)) {
    status = 422;
  }

  if (result.length === 1) {
    [result] = result;
  }

  return response.status(status).send(result);
});

app.get(["/health", "/api/v1/health"], async (_req, res) => {
  return res
    .json({
      status: "healthy",
      description: "application is healthy",
    })
    .status(200);
});

app.listen(8080, () => {
  log.info("Server listening on port 8080...");
});
