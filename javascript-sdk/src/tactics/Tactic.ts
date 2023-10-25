export interface TacticExecution {
    score: number;
    extraFields?: Record<string, any>;
}

export default interface Tactic {
    name: string;
    defaultThreshold: number;
    execute(input: string, thresholdOverride?: number): Promise<TacticExecution>;
}
