interface State {
    orgId?: string;
}
export declare function loadState(): State;
export declare function saveState(state: State): void;
export {};
