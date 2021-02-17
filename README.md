# REST-server that converts LOINC codes and UCUM units to a standardized representation

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

| Environment variable | Description                                                                                                               | Default           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| ~~TRACING_ENABLED~~  | Whether to enable distributed tracing via Jaeger. Currently unavailable due to incompatibility with latest OpenTelemetry. | `false`           |
| JAEGER_SERVICE_NAME  | Name for this service. Used for tracing.                                                                                  | `loinc-converter` |
| LOG_REQUESTS         | Whether all API requests should be logged to stdout.                                                                      | `false`           |
| PORT                 | The port to bind the web server to.                                                                                       | `8080`            |

## Development

### Install Dependencies

```sh
npm install
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
# Processor Intel(R) Core(TM) i7-6700K CPU @ 4.00GHz, 4001 Mhz, 4 Core(s), 8 Logical Processor(s)
# 32 GB DDR4 RAM @ 3600 MHz
$ bombardier -d 30s "http://localhost:8080/api/v1/conversions?loinc=718-7&unit=g%2FdL&value=10"
Bombarding http://localhost:8080/api/v1/conversions?loinc=718-7&unit=g%2FdL&value=10 for 30s using 500 connection(s)
[=================================================================================================================] 30s
Done!
Statistics        Avg      Stdev        Max
  Reqs/sec     15883.46    1672.96   52707.38
  Latency       31.51ms    45.90ms      2.76s
  HTTP codes:
    1xx - 0, 2xx - 476294, 3xx - 0, 4xx - 0, 5xx - 0
    others - 0
  Throughput:     5.61MB/s
```
