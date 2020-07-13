const chai = require("chai");
const chaiHttp = require("chai-http");
const waitOn = require("wait-on");

chai.use(chaiHttp);
const { expect } = chai;

const endpoint = process.env.API_ENDPOINT || "http://localhost:8080";

const opts = {
  resources: [`${endpoint}/health`],
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
      throw err;
    });
  api = chai.request(endpoint).post("/api/v1/conversions");
});

describe("API Endpoint", () => {
  it("accepts a single request item as body", (done) => {
    const requestBody = { loinc: "718-7", value: 12, id: 1, unit: "g/dL" };

    api.send(requestBody).then((response) => {
      expect(response).to.have.status(200);
      done();
    });
  });

  it("with a single item request, returns a single item response", (done) => {
    const requestBody = { loinc: "718-7", value: 12, id: 1, unit: "g/dL" };

    api.send(requestBody).then((response) => {
      expect(response).to.have.status(200);
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
      expect(response).to.have.status(200);
      done();
    });
  });

  it("fails if given an empty request", (done) => {
    const requestBody = {};

    api.send(requestBody).then((response) => {
      expect(response).to.have.status(400);
      done();
    });
  });

  it("fails if not given a unit", (done) => {
    api.send({ loinc: "718-7", value: 12, id: 1 }).then((response) => {
      expect(response).to.have.status(422);
      done();
    });
  });

  it("fails if not given a LOINC code", (done) => {
    api
      .send({ loinc: null, value: 12, unit: "g/dL", id: 1 })
      .then((response) => {
        expect(response).to.have.status(422);
        done();
      });
  });
});

describe("UCUM Unit Conversion", () => {
  it("standardizes UCUM codes", (done) => {
    api
      .send({ loinc: "718-7", value: 12, unit: "g/dl", id: 1 })
      .then((response) => {
        expect(response).to.have.status(200);
        expect(response.body.unit).to.equal("g/dL");
        done();
      });
  });
});

describe("LOINC Harmonization", () => {
  it.each([
    ["59260-0", 10, "mmol/l", "718-7", 16.1, "g/dL"],
    ["718-7", 3, "g/dl", "718-7", 3, "g/dL"],
  ])(
    "converts %s (%d %s) to %s (%d %s)",
    (
      inputLoinc,
      inputValue,
      inputUnit,
      expectedLoinc,
      expectedValue,
      expectedUnit,
      done
    ) => {
      api
        .send({ loinc: inputLoinc, value: inputValue, unit: inputUnit })
        .then((response) => {
          expect(response).to.have.status(200);
          const { body } = response;

          expect(body.loinc).to.equal(expectedLoinc);
          expect(body.unit).to.equal(expectedUnit);
          expect(body.value).to.equal(expectedValue);

          done();
        });
    }
  );
});
