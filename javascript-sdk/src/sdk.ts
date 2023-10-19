import {
  DetectRequest,
  DetectResponse,
  Rebuff,
  RebuffError,
  TacticResult,
  TacticStatus,
} from "./interface";
import crypto from "crypto";
import { SdkConfig } from "./config";
import initPinecone from "./lib/vectordb";
import {
  callOpenAiToDetectPI,
  detectPiUsingVectorDatabase,
} from "./lib/detect";
import getOpenAIInstance from "./lib/openai";
import { renderPromptForPiDetection } from "./lib/prompts";
import { OpenAIApi } from "openai";
import { VectorStore } from "langchain/vectorstores/base";
import { Document } from "langchain/document";
import Strategy from "./strategies/strategy";
import StandardStrategy from "./strategies/standard";

function generateCanaryWord(length = 8): string {
  // Generate a secure random hexadecimal canary word
  return crypto.randomBytes(length / 2).toString("hex");
}

export default class RebuffSdk implements Rebuff {
  private sdkConfig: SdkConfig;
  private vectorStore: VectorStore | undefined;
  private strategies: Record<string, Strategy> | undefined;
  private defaultStrategy: string;

  private openai: {
    conn: OpenAIApi;
    model: string;
  };

  constructor(config: SdkConfig) {
    this.sdkConfig = config;
    this.openai = {
      conn: getOpenAIInstance(config.openai.apikey),
      model: config.openai.model || "gpt-3.5-turbo",
    };
    this.defaultStrategy = this.sdkConfig.strategies?.default || "standard";
  }

  private async getStrategies(sdkConfig: SdkConfig): Promise<Record<string, Strategy>> {
    if (this.strategies) {
      return this.strategies;
    }
    let strategies: Record<string, Strategy> = {};
    const disabledStrategies = sdkConfig.strategies?.disabled ?? [];
    if (!disabledStrategies.includes("standard")) {
      strategies["standard"] = new StandardStrategy(await this.getVectorStore());
    }
    if (!(this.defaultStrategy in strategies)) {
      throw new RebuffError(`Default strategy "${this.defaultStrategy}" not present in enabled strategies.`)
    }
    return strategies;
  }

  async detectInjection({
    userInput = "",
    userInputBase64 = "",
    maxHeuristicScore = 0.75,
    maxVectorScore = 0.9,
    maxModelScore = 0.9,
    runHeuristicCheck = true,
    runVectorCheck = true,
    runLanguageModelCheck = true,
    strategy = "",
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

    const strategies = await this.getStrategies(this.sdkConfig);
    if (strategy && !(strategy in strategies)) {
      throw new RebuffError(`Unknown strategy: ${this.defaultStrategy}`)
    }
    strategy = strategy ?? this.defaultStrategy;
    let injectionDetected = false;
    let tacticResults: TacticResult[] = [];
    for (const tactic of strategies[strategy].tactics) {
      const result = await tactic.execute(userInput);
      if (result.detected) {
        injectionDetected = true;
      }
      tacticResults.push(result);
    }


    
    if (typeof runHeuristicCheck !== "boolean") {
      throw new RebuffError("runHeuristicCheck must be a boolean");
    }
    if (typeof runVectorCheck !== "boolean") {
      throw new RebuffError("runVectorCheck must be a boolean");
    }
    if (typeof runLanguageModelCheck !== "boolean") {
      throw new RebuffError("runLanguageModelCheck must be a boolean");
    }
    if (
      maxHeuristicScore === null ||
      maxModelScore === null ||
      maxVectorScore === null
    ) {
      throw new RebuffError(
        "maxHeuristicScore, maxModelScore, and maxVectorScore are required"
      );
    }

    runVectorCheck = runVectorCheck === null ? true : runVectorCheck;
    runLanguageModelCheck =
      runLanguageModelCheck === null ? true : runLanguageModelCheck;



    const modelScore = runLanguageModelCheck
      ? parseFloat(
          (
            await callOpenAiToDetectPI(
              renderPromptForPiDetection(userInput),
              this.openai.conn,
              this.openai.model
            )
          ).completion
        )
      : 0;

    injectionDetected =
      modelScore > maxModelScore;

    return {
      modelScore,
      runLanguageModelCheck,
      maxModelScore,
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
        this.logLeakage(userInput, { completion, canaryWord });
      }
      return true;
    }
    return false;
  }

  async getVectorStore(): Promise<VectorStore> {
    if (this.vectorStore) {
      return this.vectorStore;
    }
    this.vectorStore = await initPinecone(
      this.sdkConfig.pinecone.environment,
      this.sdkConfig.pinecone.apikey,
      this.sdkConfig.pinecone.index,
      this.sdkConfig.openai.apikey
    );
    return this.vectorStore
  }

  async logLeakage(
    input: string,
    metaData: Record<string, string>
  ): Promise<void> {
    await (await this.getVectorStore()).addDocuments([new Document({
      metadata: metaData,
      pageContent: input,
    })]);
  }
}
