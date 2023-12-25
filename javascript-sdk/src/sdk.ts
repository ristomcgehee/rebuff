import {
  DetectRequest,
  DetectResponse,
  Rebuff,
  RebuffError,
  TacticName,
  TacticResult,
} from "./interface";
import crypto from "crypto";
import { SdkConfig } from "./config";
import initVectorStore from "./lib/vectordb";
import getOpenAIInstance from "./lib/openai";
import { VectorStore } from "langchain/vectorstores/base";
import { Document } from "langchain/document";
import Strategy from "./lib/Strategy";
import Heuristic from "./tactics/Heuristic";
import OpenAI from "./tactics/OpenAI";
import Vector from "./tactics/Vector";
import Tactic from "./tactics/Tactic";

function generateCanaryWord(length = 8): string {
  // Generate a secure random hexadecimal canary word
  return crypto.randomBytes(length / 2).toString("hex");
}

export default class RebuffSdk implements Rebuff {
  private vectorStore: VectorStore;
  private strategies: Record<string, Strategy>;
  private defaultStrategy: string;

  private constructor(strategies: Record<string, Strategy>, defaultStrategy: string, vectorStore: VectorStore) {
    this.strategies = strategies;
    this.defaultStrategy = defaultStrategy;
    this.vectorStore = vectorStore;
  }

  public static async init(config: SdkConfig): Promise<RebuffSdk> {
    const vectorStore = await initVectorStore(config);
    const strategies = await RebuffSdk.getStrategies(config, vectorStore);
    const defaultStrategy = config.defaultStrategy || "standard";
    if (!strategies[defaultStrategy]) {
      throw new RebuffError(
        `Default strategy not found: ${defaultStrategy}`
      );
    }
    return new RebuffSdk(strategies, defaultStrategy, vectorStore);
  }

  private static async getStrategies(config: SdkConfig, vectorStore: VectorStore): Promise<Record<string, Strategy>> {
    let strategiesConfig = config.strategies ? [...config.strategies] : [];
    if (strategiesConfig.length === 0) {
      strategiesConfig.push({
        name: "standard",
        tactics: [
          { name: TacticName.Heuristic, threshold: 0.75 },
          { name: TacticName.VectorDB, threshold: 0.9 },
          { name: TacticName.LanguageModel, threshold: 0.9 },
        ],
      });
    }
    const openai = {
      conn: getOpenAIInstance(config.openai.apikey),
      model: config.openai.model || "gpt-3.5-turbo",
    };
    const strategies: Record<string, Strategy> = {};
    for (const strategyConfig of strategiesConfig) {
      if (strategies[strategyConfig.name]) {
        throw new RebuffError(`Duplicate strategy name: ${strategyConfig.name}`);
      }
      let tactics = [] as Tactic[];
      for (const tacticConfig of strategyConfig.tactics) {
        if (tacticConfig.name === TacticName.Heuristic) {
          tactics.push(new Heuristic(tacticConfig.threshold));
        } else if (tacticConfig.name === TacticName.VectorDB) {
          tactics.push(new Vector(tacticConfig.threshold, vectorStore));
        } else if (tacticConfig.name === TacticName.LanguageModel) {
          tactics.push(new OpenAI(tacticConfig.threshold, openai.model, openai.conn));
        } else {
          throw new RebuffError(`Unknown tactic name: ${tacticConfig.name}`);
        }
      }
      strategies[strategyConfig.name] = tactics;
    }
    return strategies;
  }

  async detectInjection({
    userInput = "",
    userInputBase64 = "",
    tacticOverrides = [],
    strategy = this.defaultStrategy,
  }: DetectRequest): Promise<DetectResponse> {
    if (userInputBase64) {
      // Create a buffer from the hexadecimal string
      const userInputBuffer = Buffer.from(userInputBase64, "hex");
      // Decode the buffer to a UTF-8 string
      userInput = userInputBuffer.toString("utf-8");
    }
    if (!userInput) {
      throw new RebuffError("userInput is required");
    }
    if (!this.strategies[strategy]) {
      throw new RebuffError(`Strategy not found: ${strategy}`);
    }

    let injectionDetected = false;
    let tacticResults: TacticResult[] = [];
    for (const tactic of this.strategies[strategy]) {
      const tacticOverride = tacticOverrides.find(t => t.name === tactic.name);
      if (tacticOverride && tacticOverride.run === false) {
        continue;
      }
      const threshold = tacticOverride?.threshold ?? tactic.defaultThreshold;
      const execution = await tactic.execute(userInput, threshold);
      const result = {
        name: tactic.name,
        score: execution.score,
        threshold,
        detected: execution.score > threshold,
        additionalFields: execution.additionalFields ?? {},
      } as TacticResult;
      if (result.detected) {
        injectionDetected = true;
      }
      tacticResults.push(result);
    }

    return {
      injectionDetected,
      tacticResults,
    } as DetectResponse;
  }

  addCanaryWord(
    prompt: string,
    canaryWord: string = generateCanaryWord(),
    canaryFormat = "<!-- {canary_word} -->"
  ): [string, string] {
    // Embed the canary word in the specified format
    const canaryComment = canaryFormat.replace("{canary_word}", canaryWord);
    const promptWithCanary = `${canaryComment}\n${prompt}`;
    return [promptWithCanary, canaryWord];
  }

  isCanaryWordLeaked(
    userInput: string,
    completion: string,
    canaryWord: string,
    logOutcome = true
  ): boolean {
    // Check if the canary word appears in the completion
    if (completion.includes(canaryWord)) {
      if (logOutcome) {
        this.logLeakage(userInput, { completion, "canary_word": canaryWord });
      }
      return true;
    }
    return false;
  }

  async logLeakage(
    input: string,
    metaData: Record<string, string>
  ): Promise<void> {
    await this.vectorStore.addDocuments([new Document({
      metadata: metaData,
      pageContent: input,
    })]);
  }
}
