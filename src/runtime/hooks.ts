type AdvanceHandler = (ms: number) => void;

let advanceHandler: AdvanceHandler = () => {
  // no-op until race scene registers a deterministic step handler.
};

export function setAdvanceHandler(handler: AdvanceHandler): void {
  advanceHandler = handler;
}

export function advanceTime(ms: number): void {
  advanceHandler(ms);
}
