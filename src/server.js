/* eslint-disable no-restricted-syntax */
const fs = require("fs");
const parse = require("csv-parse/lib/sync");
const ucum = require("@lhncbc/ucum-lhc");
const HttpStatus = require("http-status-codes");
const log = require("pino")();

const app = require("fastify")({
  logger:
    process.env.LOG_REQUESTS === "true" || process.env.LOG_REQUESTS === "1",
});

const arbUnits = {};
const loincUnits = {};
const synonyms = {};
const conversionUnits = {};

// Read arb'U = arbitrary unit conversions (UCUM [arb'U] requires special
// consideration, as it CANNOT BE CONVERTED):
log.info("Parsing 'arb-u.tsv'...");
try {
  const arbCsv = parse(fs.readFileSync("data/arb-u.tsv", "utf-8"), {
    columns: true,
    delimiter: "\t",
  });

  for (const entry of arbCsv) {
    arbUnits[entry.FROM_UNIT] = entry.TO_UNIT;
  }
} catch (e) {
  log.info("Could not load 'arb_U.tsv'.", e);
  process.exit(1);
}

// Read official loinc database:
log.info("Parsing 'loinc.csv'...");
try {
  const loincCsv = parse(fs.readFileSync("data/loinc.csv", "utf-8"), {
    columns: true,
  });

  for (const entry of loincCsv) {
    // Special handling for [arb'U] = arbitrary unit as it CANNOT BE CONVERTED,
    // use entry from arb-u.tsv:
    if (entry.EXAMPLE_UCUM_UNITS === "[arb'U]") {
      const exUnits = entry.EXAMPLE_UNITS.split(";");
      for (const exUnit of exUnits) {
        if (exUnit in arbUnits) {
          loincUnits[entry.LOINC_NUM] = {
            exampleUcumUnits: arbUnits[exUnit],
            display: entry.LONG_COMMON_NAME,
          };
          break;
        }
      }
      if (!(entry.LOINC_NUM in loincUnits)) {
        loincUnits[entry.LOINC_NUM] = {
          exampleUcumUnits: "[arb'U]",
          display: entry.LONG_COMMON_NAME,
        };
      }
    } else {
      loincUnits[entry.LOINC_NUM] = {
        exampleUcumUnits: entry.EXAMPLE_UCUM_UNITS,
        display: entry.LONG_COMMON_NAME,
      };
    }
  }
} catch (e) {
  log.error(
    `Could not load 'loinc.csv': ${e}. ` +
      "Did you download the official 'LOINC Table File (CSV)'" +
      "from 'https://loinc.org/downloads/loinc-table/' and extract 'Loinc.csv'?",
    e
  );
  process.exit(1);
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
  process.exit(1);
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
    const existingEntry = loincUnits[entry.TARGET_LOINC];
    // Custom conversion units supersede "default LOINC" units:
    loincUnits[entry.TARGET_LOINC] = {
      exampleUcumUnits: entry.TO_UNIT,
      display: existingEntry?.LONG_COMMON_NAME,
    };
  }
} catch (e) {
  log.error(`Could not load 'conversion.csv': ${e}`, e);
  process.exit(1);
}

// Create UCUM conversion singleton:
const utils = ucum.UcumLhcUtils.getInstance();

function convert(loinc, unit, value = 1.0) {
  if (!loinc) {
    throw new Error("LOINC code is required");
  }

  if (!unit) {
    throw new Error("Unit is required");
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

  // if the input LOINC is part of the "LOINC-to-LOINC" conversion table
  // the input is first converted to the harmonized LOINC code and expected UCUM unit
  if (loinc in conversionUnits) {
    // first convert the input unit ("unit") to the expected
    // source or "FROM_UNIT" from the loinc-specific conversion table
    const toUnitCode = conversionUnits[loinc].FROM_UNIT;
    const result = utils.convertUnitTo(unit, value, toUnitCode);
    if (result.status !== "succeeded") {
      throw new Error(
        `Failed to convert ${unit} to ${toUnitCode} via the custom conversion table: ${result.msg}`,
        { unit, toUnitCode }
      );
    }
    value = result.toVal;
    // --> unit = conversion[loinc]["FROM_UNIT"];

    // finally convert the source LOINC value (now in "FROM_UNIT" units)
    // to the "TO_LOINC" to the "TO_UNIT" value using the specific conversion factor
    value *= conversionUnits[loinc].FACTOR;
    unit = conversionUnits[loinc].TO_UNIT;
    loinc = conversionUnits[loinc].TO_LOINC;
  }

  // Convert using UCUM lib:
  // HACK: arbitrary Unit IU cannot be converted, replace w/ {arbitrary:IU}:
  const targetUnit = loincUnits[loinc].exampleUcumUnits;
  const conversion = utils.convertUnitTo(
    unit.replace("[IU]", "{arbitrary:IU}"),
    value,
    targetUnit.replace("[IU]", "{arbitrary:IU}")
  );

  if (conversion.status !== "succeeded") {
    throw new Error(
      `Cannot convert ${unit} to ${targetUnit}: ${conversion.msg}`,
      {
        unit,
        targetUnit,
      }
    );
  }

  return {
    value: conversion.toVal,
    unit: targetUnit.replace("{arbitrary:IU}", "[IU]"),
    loinc,
    display: loincUnits[loinc].display,
  };
}

// Readiness and liveness probes. Used by Docker healthchecks and Kubernetes probes
app.route({
  method: ["GET", "HEAD"],
  url: "/ready",
  handler: async (_request, reply) => {
    reply.send("OK");
  },
});

app.route({
  method: ["GET", "HEAD"],
  url: "/live",
  handler: async (_request, reply) => {
    reply.send("OK");
  },
});

app.get("/api/v1/conversions", async (req, resp) => {
  const { loinc, unit, value } = req.query;

  let result = {};
  let status = HttpStatus.StatusCodes.OK;

  try {
    result = convert(loinc, unit, value);
  } catch (e) {
    result.error = `Exception during conversion: ${e}`;
    status = HttpStatus.StatusCodes.BAD_REQUEST;
  }

  return resp.status(status).send(result);
});

const postHandler = async (request, response) => {
  let result = [];

  let requestBody = request.body;

  if (
    Object.entries(requestBody).length === 0 &&
    requestBody.constructor === Object
  ) {
    return response
      .status(HttpStatus.StatusCodes.BAD_REQUEST)
      .send({ error: "Empty request body." });
  }

  if (!Array.isArray(request.body)) {
    requestBody = [request.body];
  }

  for (const entry of requestBody) {
    let rsEntry = {};

    try {
      rsEntry = convert(entry.loinc, entry.unit, entry.value);
    } catch (e) {
      rsEntry.error = `Exception during conversion: ${e}`;
    }

    if ("id" in entry) {
      rsEntry.id = entry.id;
    }

    // Result JSON:
    result.push(rsEntry);
  }

  let status = HttpStatus.StatusCodes.OK;

  if (result.some((entry) => entry.error)) {
    status = HttpStatus.StatusCodes.BAD_REQUEST;
  }

  if (result.length === 1) {
    [result] = result;
  }

  return response.status(status).send(result);
};

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
app.post("/conversions", postHandler);
app.post("/api/v1/conversions", postHandler);

const port = process.env.PORT || 8080;

const start = async () => {
  try {
    await app.listen(port, "0.0.0.0");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};
start();
