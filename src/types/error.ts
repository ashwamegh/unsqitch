export type ErrorType =
  | 'sqitch_crash'
  | 'db_connection'
  | 'file_permission'
  | 'binary_not_found'
  | 'partial_deployment'
  | 'command_timeout'
  | 'unknown';

export interface ErrorAction {
  label: string;
  action: 'retry' | 'revert' | 'view_log' | 'check_connection' | 'open_settings' | 'open_file_manager' | 'refresh';
}

export interface AppError {
  type: ErrorType;
  message: string;
  sqitchOutput?: string;
  recoverable: boolean;
  actions: ErrorAction[];
}

export function createAppError(type: ErrorType, message: string, sqitchOutput?: string): AppError {
  const actionMap: Record<ErrorType, ErrorAction[]> = {
    sqitch_crash: [
      { label: 'View Log', action: 'view_log' },
      { label: 'Retry', action: 'retry' },
    ],
    db_connection: [
      { label: 'Check Connection', action: 'check_connection' },
      { label: 'Retry', action: 'retry' },
    ],
    file_permission: [
      { label: 'Open File Manager', action: 'open_file_manager' },
    ],
    binary_not_found: [
      { label: 'Open Settings', action: 'open_settings' },
    ],
    partial_deployment: [
      { label: 'Deploy Remaining', action: 'retry' },
      { label: 'Revert All', action: 'revert' },
    ],
    command_timeout: [
      { label: 'Retry', action: 'retry' },
      { label: 'Open Settings', action: 'open_settings' },
    ],
    unknown: [
      { label: 'Refresh', action: 'refresh' },
    ],
  };

  return {
    type,
    message,
    sqitchOutput,
    recoverable: type !== 'binary_not_found',
    actions: actionMap[type],
  };
}
