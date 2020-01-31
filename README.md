# REST-server that converts LOINC codes and UCUM units to a standardized representation

Returns a standardized _UCUM_ unit for each _LOINC_ code. (In most cases, the
returned _UCUM_ unit is the `EXAMPLE_UNIT` defined in `Loinc.csv`.)

Selected _LOINC_ codes that represent the same concept, and where a unambiguous
conversion factor exists (e.g. `718-7 = "Hemoglobin [Mass/volume] in Blood"` and
`59260-0 = "Hemoglobin [Moles/volume] in Blood"`), are converted to an arbitrarily
selected _LOINC_ code (718-7 in the example).

## REST server

Endpoint: `POST /conversions`

Content-type: `application/json`

Body:

```json
[
  {
    "loinc": "str, e.g. 718-7",
    "unit": "UCUM unit, e.g. g/dL",
    "value": float, optional(=1.0),
    "id": anything_you_want, optional
  }+
]
```

Example:

Query:

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

Result:

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
