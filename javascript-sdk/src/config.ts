export interface ApiConfig {
  apiKey: string;
  apiUrl?: string;
}

export interface DetectionStrategy {
  // name must be uniqe and not match the name of any built-in strategy.
  name: string;
  tactics: {
    name: string;
    // scoreThreshold is a number between 0 and 1.
    scoreThreshold: number;
  }[];
}

export interface SdkConfig {
  pinecone: {
    apikey: string;
    environment: string;
    index: string;
  };
  openai: {
    apikey: string;
    model: string;
  };
  // strategies allows customizations of the available strategies. If not specified, the following built-in strategy is used:
  // TODO(risto): add built-in strategies
  strategies?: {
    // custom is a list of custom detection strategies. The name of any custom strategy cannot match the name of a built-in strategy.
    custom?: DetectionStrategy[],
    // disabled is a list of built-in strategies to disable.
    disabled?: string[],
    // default is the name of the strategy to use by default. If not specified, the TODO(risto) strategy is used.
    default?: string;
  }
}

export type RebuffConfig = ApiConfig | SdkConfig;
