export default interface Tactic {
    tacticName: string;
    getScore(input: string): Promise<number>;
}
