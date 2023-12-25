import { TacticName } from "./interface";

export interface ApiConfig {
  // The API key to use for the Rebuff API.
  apiKey: string;
  // The URL of the Rebuff API. Defaults to https://playground.rebuff.ai.
  apiUrl?: string;
}

export interface DetectionTactic {
  // The name of the tactic.
  name: TacticName;
  // The threshold to use for this tactic, between 0 and 1, inclusive. If the score is above this threshold, the tactic
  // will be considered detected.
  threshold: number;
}

export interface DetectionStrategy {
  // The name of the strategy. This is used to invoke this strategy at detection time.
  name: string;
  // The tactics that will be executed as part of this strategy.
  tactics: DetectionTactic[];
}

export type VectorDbConfig = {
  pinecone: {
    apikey: string;
    environment: string;
    index: string;
  };
} | {
  chroma: {
    url: string;
    collectionName: string;
  };
};

export interface SdkConfig {
  vectorDB: VectorDbConfig
  openai: {
    apikey: string;
    // Defaults to "gpt-3.5-turbo".
    model?: string;
  };
  // The strategies to make available to the caller at detection time. If not specified, the "standard" strategy will
  // be included, which consists of the following tactics:
  // - "heuristic", threshold 0.75
  // - "vector_db", threshold 0.9
  // - "language_model", threshold 0.9
  strategies?: DetectionStrategy[];
  // The strategy to use at detection time when the caller does not specify a strategy. If this property is not
  // specified, "standard" will be the default strategy.
  defaultStrategy?: string;
};

export type RebuffConfig = ApiConfig | SdkConfig;
