# loinc-conversion
## REST-server that converts LOINC codes and UCUM units to a standardized
## representation
Returns a standardized UCUM unit for each LOINC code. (In most cases, the
returned UCUM unit is the EXAMPLE_UNIT defined in Loinc.csv.)
Selected LOINC codes that represent the same concept, and where a unambiguous
conversion factor exists (e.g. 718-7 = "Hemoglobin [Mass/volume] in Blood" and
59260-0 = "Hemoglobin [Moles/volume] in Blood"), are converted to an arbitrarily
selected LOINC code (718-7 in the example).