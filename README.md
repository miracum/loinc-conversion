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
   selected *LOINC* code (`718-7` in the example).

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
