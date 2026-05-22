export type SqitchEventType = 'deploy' | 'revert' | 'verify';
export type SqitchEventStatus = 'ok' | 'not_ok' | 'failed' | 'running';

export interface SqitchEvent {
  type: SqitchEventType;
  change: string;
  target?: string;
  status: SqitchEventStatus;
  rawLine: string;
}

export interface SqitchParsedOutput {
  events: SqitchEvent[];
  rawOutput: string;
  exitCode: number | null;
}
