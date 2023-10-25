export interface TacticOverride {
  // The name of the tactic to override.
  name: string;
  // The threshold to use for this tactic. If the score is above this threshold, the tactic will be considered detected.
  // If not specified, the default threshold for the tactic will be used.
  threshold?: number;
  // Set to false to prevent this tactic from running. Defaults to true if not specified.
  run?: boolean;
}

export interface DetectRequest {
  userInput: string;
  userInputBase64?: string;
  strategy?: string;
  tacticOverrides?: TacticOverride[];
}

export interface TacticResult {
  name: string;
  score: number;
  threshold: number;
  detected: boolean;
  extraFields: Record<string, any>;
}

export interface DetectResponse {
  injectionDetected: boolean;
  tacticResults: TacticResult[];
  strategy: string;
}

export class RebuffError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RebuffError";
  }
}

export interface Rebuff {
  detectInjection(request: DetectRequest): Promise<DetectResponse>;

  addCanaryWord(
    prompt: string,
    canaryWord?: string,
    canaryFormat?: string
  ): [string, string];

  isCanaryWordLeaked(
    userInput: string,
    completion: string,
    canaryWord: string,
    logOutcome?: boolean
  ): boolean;

  logLeakage(input: string, metaData: Record<string, string>): Promise<void>;
}
