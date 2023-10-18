export interface DetectRequest {
  userInput: string;
  userInputBase64?: string;
  runHeuristicCheck: boolean;
  runVectorCheck: boolean;
  runLanguageModelCheck: boolean;
  maxHeuristicScore: number;
  maxModelScore: number;
  maxVectorScore: number;
  strategy: string;
}

export enum TacticStatus {
  passed = "passed",
  failed = "failed",
}

export interface TacticResult {
  name: string;
  score: number;
  threshold: number;
  detected: boolean;
}

export interface DetectResponse {
  modelScore: number;
  vectorScore: Record<string, number>;
  runVectorCheck: boolean;
  runLanguageModelCheck: boolean;
  maxVectorScore: number;
  maxModelScore: number;
  injectionDetected: boolean;
  tacticResults: TacticResult[];
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
