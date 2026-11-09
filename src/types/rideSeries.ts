/** Result of one materialization pass, surfaced for logging and tests. */
export type MaterializeResult = {
  seriesProcessed: number;
  ridesCreated: number;
  ridesSkipped: number;
};
