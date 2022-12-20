const chai = require("chai");
const chaiHttp = require("chai-http");
const waitOn = require("wait-on");
const HttpStatus = require("http-status-codes");

chai.use(chaiHttp);
const { expect } = chai;

const endpoint = process.env.API_ENDPOINT || "http://localhost:8080";

const opts = {
  resources: [`${endpoint}/ready`],
  delay: 1000, // initial delay in ms
  interval: 250, // poll interval in ms
  timeout: 30000, // timeout in ms
  tcpTimeout: 1000, // tcp timeout in ms
  window: 1000, // stabilization time in ms
};

let api = {};

beforeEach((done) => {
  waitOn(opts)
    .then(() => {
      // once here, all resources are available
      done();
    })
    .catch((err) => {
      console.log(err);
      throw err;
    });
  api = chai.request(endpoint).post("/api/v1/conversions");
}, 20000);

describe("API Endpoint", () => {
  it("accepts a single request item as body", (done) => {
    const requestBody = { loinc: "718-7", value: 12, id: 1, unit: "g/dL" };

    api.send(requestBody).then((response) => {
      expect(response).to.have.status(HttpStatus.StatusCodes.OK);
      done();
    });
  });

  it("with a single item request, returns a single item response", (done) => {
    const requestBody = { loinc: "718-7", value: 12, id: 1, unit: "g/dL" };

    api.send(requestBody).then((response) => {
      expect(response).to.have.status(HttpStatus.StatusCodes.OK);
      expect(response.body).not.be.an.instanceof(Array);
      done();
    });
  });

  it("accepts a list of request items as body", (done) => {
    const requestBody = [
      { loinc: "718-7", value: 12, unit: "g/dL" },
      {
        loinc: "59260-0",
        unit: "mmol/l",
        value: 12,
      },
    ];

    api.send(requestBody).then((response) => {
      expect(response).to.have.status(HttpStatus.StatusCodes.OK);
      done();
    });
  });

  it("fails if given an empty request", (done) => {
    const requestBody = {};

    api.send(requestBody).then((response) => {
      expect(response).to.have.status(HttpStatus.StatusCodes.BAD_REQUEST);
      done();
    });
  });

  it("fails if not given a unit", (done) => {
    api.send({ loinc: "718-7", value: 12, id: 1 }).then((response) => {
      expect(response).to.have.status(HttpStatus.StatusCodes.BAD_REQUEST);
      done();
    });
  });

  it("fails if not given a LOINC code", (done) => {
    api
      .send({ loinc: null, value: 12, unit: "g/dL", id: 1 })
      .then((response) => {
        expect(response).to.have.status(HttpStatus.StatusCodes.BAD_REQUEST);
        done();
      });
  });
});

describe("UCUM Unit Conversion", () => {
  it("standardizes UCUM codes", (done) => {
    api
      .send({ loinc: "718-7", value: 12, unit: "g/dl", id: 1 })
      .then((response) => {
        expect(response).to.have.status(HttpStatus.StatusCodes.OK);
        expect(response.body.unit).to.equal("g/dL");
        done();
      });
  });

  it("fails if given an inconvertible unit as part of the custom conversion table", (done) => {
    api
      .send({ loinc: "14854-4", value: 12, unit: "W/(24.h)" })
      .then((response) => {
        expect(response).to.have.status(HttpStatus.StatusCodes.BAD_REQUEST);
        expect(response.body.error).to.contain(
          "W/(24.h) cannot be converted to nmol/(24.h)."
        );
        done();
      });
  });

  it("returns original unit and warning if given loinc without example unit and ucum code", (done) => {
    api
      .send({ loinc: "10346-5", value: 2000, unit: "/ml", id: 1 })
      .then((response) => {
        expect(response).to.have.status(HttpStatus.StatusCodes.OK);
        expect(response.body.unit).to.equal("/ml");
        expect(response.body.value).to.equal(2000);
        expect(response.body).to.have.property("warning");
        expect(response.body.warning).to.contain(
          "No UCUM unit given for LOINC Code 10346-5, will return /ml"
        );
        done();
      });
  });

  it("returns ucum unit and warning if given loinc without example unit and non-ucum code", (done) => {
    api
      .send({ loinc: "10346-5", value: 2000, unit: "micromol/L", id: 1 })
      .then((response) => {
        expect(response).to.have.status(HttpStatus.StatusCodes.OK);
        expect(response.body.unit).to.equal("umol/L");
        expect(response.body.value).to.equal(2000);
        expect(response.body).to.have.property("warning");
        expect(response.body.warning).to.contain(
          "No UCUM unit given for LOINC Code 10346-5, will return umol/L"
        );
        done();
      });
  });
});

describe("LOINC Harmonization", () => {
  it.each([
    [
      "59260-0",
      10,
      "mmol/l",
      "718-7",
      16.1,
      "g/dL",
      "Hemoglobin [Mass/volume] in Blood",
    ],
    [
      "718-7",
      3,
      "g/dl",
      "718-7",
      3,
      "g/dL",
      "Hemoglobin [Mass/volume] in Blood",
    ],
    [
      "62238-1",
      3,
      "ml/min/1,73m²",
      "62238-1",
      3,
      "mL/min/{1.73_m2}",
      "Glomerular filtration rate/1.73 sq M.predicted [Volume Rate/Area] in Serum, Plasma or Blood by Creatinine-based formula (CKD-EPI)",
    ],
    [
      "14854-4",
      1,
      "nmol/(24.h)",
      "2668-2",
      0.1692,
      "ug/(24.h)",
      "Norepinephrine [Mass/time] in 24 hour Urine",
    ],
    [
      "8329-5",
      37,
      "Cel",
      "8329-5",
      98.6,
      "[degF]",
      "Body temperature - Core",
    ],
    [
      "8329-5",
      37.291234453432252849,
      "Cel",
      "8329-5",
      // weird behaviour of used toFixed function with large number of digits
      // it still rounds correctly but to smaller number of digits than anticipated
      99.12422202,
      "[degF]",
      "Body temperature - Core",
    ],
  ])(
    "converts %s (%d %s) to %s (%d %s) with display '%s'",
    (
      inputLoinc,
      inputValue,
      inputUnit,
      expectedLoinc,
      expectedValue,
      expectedUnit,
      expectedDisplay,
      done
    ) => {
      api
        .send({ loinc: inputLoinc, value: inputValue, unit: inputUnit })
        .then((response) => {
          expect(response).to.have.status(HttpStatus.StatusCodes.OK);
          const { body } = response;

          expect(body.loinc).to.equal(expectedLoinc);
          expect(body.unit).to.equal(expectedUnit);
          expect(body.value).to.equal(expectedValue);
          expect(body.display).to.equal(expectedDisplay);

          done();
        });
    }
  );
});
