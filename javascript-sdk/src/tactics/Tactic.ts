import { TacticName } from "../interface";

export interface TacticExecution {
    score: number;
    additionalFields?: Record<string, any>;
}

export default interface Tactic {
    name: TacticName;
    defaultThreshold: number;
    execute(input: string, thresholdOverride?: number): Promise<TacticExecution>;
}
