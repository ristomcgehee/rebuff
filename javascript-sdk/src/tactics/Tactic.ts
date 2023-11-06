export interface TacticExecution {
    score: number;
    additionalFields?: Record<string, any>;
}

export default interface Tactic {
    name: string;
    defaultThreshold: number;
    execute(input: string, thresholdOverride?: number): Promise<TacticExecution>;
}
