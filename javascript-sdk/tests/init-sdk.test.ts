/* eslint-disable @typescript-eslint/no-unused-expressions */
import { describe } from "mocha";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { DetectRequest, DetectResponse, TacticName } from "../src/interface";
import RebuffSDK from "../src/sdk";
import { getEnvironmentVariable } from "./helpers";

chai.use(chaiAsPromised);
const expect = chai.expect;

const sdkConfigBase = {
  openai: {
    apikey: getEnvironmentVariable("OPENAI_API_KEY"),
    model: "gpt-3.5-turbo",
  },
  vectorDB: {
    pinecone: {
      environment: getEnvironmentVariable("PINECONE_ENVIRONMENT"),
      apikey: getEnvironmentVariable("PINECONE_API_KEY"),
      index: getEnvironmentVariable("PINECONE_INDEX_NAME"),
    }
  }
};

// eslint-disable-next-line func-names
describe("Custom strategies tests", function () {

  describe("No strategy specified, bad defaultStrategy", () => {
    it("should fail during init", async () => {
      expect(RebuffSDK.init({
        ...sdkConfigBase,
        defaultStrategy: "badStrategy",
      })).to.be.rejected;
    });
  });

  describe("Strategy specified, valid defaultStrategy", () => {
    it("should run detectInjection successfully", async () => {
      const rb = await RebuffSDK.init({
        ...sdkConfigBase,
        strategies: [{
          name: "customStrategy",
          tactics: [{
            name: TacticName.Heuristic,
            threshold: 0.5,
          }],
        }],
        defaultStrategy: "customStrategy",
      });
      const detectResponse = await rb.detectInjection({
        userInput: "some query",
      });
      expect(detectResponse).to.not.be.undefined;
      expect(detectResponse.tacticResults).to.have.lengthOf(1);
      expect(detectResponse.tacticResults[0].name).to.eq(TacticName.Heuristic)
    });
  });

  describe("Strategy specified, unspecified defaultStrategy", () => {
    it("should fail during init", async () => {
      expect(RebuffSDK.init({
        ...sdkConfigBase,
        strategies: [{
          name: "customStrategy",
          tactics: [{
            name: TacticName.Heuristic,
            threshold: 0.5,
          }],
        }],
      })).to.be.rejected;
    });
  });

  describe("Strategy specified, unspecified defaultStrategy", () => {
    it("should fail during init", () => {
      expect(RebuffSDK.init({
        ...sdkConfigBase,
        strategies: [{
          name: "customStrategy",
          tactics: [{
            name: TacticName.Heuristic,
            threshold: 0.5,
          }],
        }],
      })).to.be.rejected;
    });
  });
});
