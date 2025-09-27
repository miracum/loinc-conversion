# loinc-conversion

[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/miracum/loinc-conversion/badge)](https://scorecard.dev/viewer/?uri=github.com/miracum/loinc-conversion)
[![SLSA 3](https://slsa.dev/images/gh-badge-level3.svg)](https://slsa.dev)

Service that converts LOINC codes and UCUM units to a standardized representation.
_loinc-conversion_ is a _REST_-server that accepts lists of `(LOINC-code, unit, value?)` and returns corresponding lists of `(LOINC-code, UCUM-unit, value)`.
It provides three distinct functions:

1. **Standardization of _UCUM_ units**
   Returns a standardized _UCUM_ unit for each _LOINC_ code. (In most cases, the
   returned _UCUM_ unit is the `EXAMPLE_UNIT` defined in the official `Loinc.csv`
   by Regenstrief.)

2. **Conversion of non-_UCUM_ units**
   For selected common (especially in Germany) non-_UCUM_ laboratory units the
   valid _UCUM_ unit is provided.

3. **Conversion of _LOINC_ codes**
   Selected _LOINC_ codes that represent the same concept, and where a unambiguous
   conversion factor exists (e.g. `718-7 = "Hemoglobin [Mass/volume] in Blood"` and
   `59260-0 = "Hemoglobin [Moles/volume] in Blood"`), are converted to an arbitrarily\*
   selected _LOINC_ code (`718-7` in the example).

   \*The conversion _target_ is the _more common_ unit - which is highly subjective.

## REST server description

Endpoint: `POST /conversions`
Content-type: `application/json`
Body:

```json
[
  {
    "loinc": "str, e.g. 718-7",
    "unit": "UCUM unit, e.g. g/dL",
    "value": "float, optional(=1.0)",
    "id": "anything_you_want, optional"
  }
]
```

### Example

#### Query

```txt
POST http://localhost:8080/conversions HTTP/1.1
content-type: application/json
```

```json
[
  {
    "loinc": "718-7",
    "unit": "g/dL",
    "value": 12,
    "id": "my_internal_id_22"
  },
  {
    "loinc": "59260-0",
    "unit": "mmol/l",
    "value": 10
  }
]
```

#### Result

```json
[
  {
    "value": 12,
    "unit": "g/dL",
    "loinc": "718-7",
    "id": "my_internal_id_22"
  },
  {
    "value": 16.1,
    "unit": "g/dL",
    "loinc": "718-7"
  }
]
```

## Configuration

| Environment variable | Description                                                                            | Default |
| -------------------- | -------------------------------------------------------------------------------------- | ------- |
| LOG_REQUESTS         | Whether all API requests should be logged to stdout.                                   | `false` |
| PORT                 | The port to bind the web server to.                                                    | `8080`  |
| LOINC_VERSION        | The version of the LOINC database to use for conversion. Valid options: `2.67`, `2.77` | `2.67`  |

## Development

### Install Dependencies

```sh
npm clean-install
```

### Run with hot reload

```sh
npm run watch
```

The app now runs on <http://localhost:8080/api/v1/conversions> and restarts everytime a file in the `src/` dir changes.

### Run tests

```sh
npm run tests:e2e
```

This expects the app to run on <http://localhost:8080>. You can specify a different endpoint by setting the `API_ENDPOINT` env var.

## Benchmark

```sh
# OS=Windows 11 (10.0.22000.978/21H2)
# 12th Gen Intel Core i9-12900K, 1 CPU, 24 logical and 16 physical cores
# 32GiB of DDR5 4800MHz RAM
# Samsung SSD 980 Pro 1TiB
# NodeJS v24
$ bombardier -d 30s "http://localhost:8080/api/v1/conversions?loinc=718-7&unit=g%2FdL&value=10"
Bombarding http://localhost:8080/api/v1/conversions?loinc=718-7&unit=g%2FdL&value=10 for 30s using 125 connection(s)
[===========================================================================================================] 30s
Done!
Statistics        Avg      Stdev        Max
  Reqs/sec     40843.02    4452.14   60068.12
  Latency        3.06ms     1.99ms   370.35ms
  HTTP codes:
    1xx - 0, 2xx - 1225358, 3xx - 0, 4xx - 0, 5xx - 0
    others - 0
  Throughput:    16.48MB/s
```

## Legal

This material contains content from LOINC (loinc.org). LOINC is copyright © 1995-2025, Regenstrief Institute, Inc. and the Logical Observation Identifiers Names and Codes (LOINC) Committee and is available at no cost under the license at loinc.org/license. LOINC® is a registered United States trademark of Regenstrief Institute, Inc.
