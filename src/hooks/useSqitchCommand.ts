import { useState, useCallback } from 'react';
import { useProjectStore } from '../store/project';
import { useIpc } from './useIpc';

interface CommandState {
  isRunning: boolean;
  error: string | null;
  output: string;
}

export function useSqitchCommand() {
  const ipc = useIpc();
  const [state, setState] = useState<CommandState>({ isRunning: false, error: null, output: '' });

  const run = useCallback(async (
    command: 'deploy' | 'revert' | 'verify' | 'status' | 'log' | 'add' | 'init',
    args: Record<string, unknown>
  ) => {
    setState({ isRunning: true, error: null, output: '' });
    useProjectStore.getState().setRunning(true);
    try {
      let result: unknown;
      switch (command) {
        case 'deploy':
          result = await ipc.sqitchDeploy(args.projectPath as string, args.target as string, args.toChange as string | undefined);
          break;
        case 'revert':
          result = await ipc.sqitchRevert(args.projectPath as string, args.target as string, args.toChange as string | undefined);
          break;
        case 'verify':
          result = await ipc.sqitchVerify(args.projectPath as string, args.target as string);
          break;
        case 'status':
          result = await ipc.sqitchStatus(args.projectPath as string, args.target as string);
          break;
        case 'log':
          result = await ipc.sqitchLog(args.projectPath as string, args.target as string);
          break;
        case 'add':
          result = await ipc.sqitchAdd(args.projectPath as string, args.name as string, args.note as string, args.requires as string[], args.conflicts as string[]);
          break;
        case 'init':
          result = await ipc.sqitchInit(args.directory as string, args.name as string, args.engine as string, args.uri as string, args.topDir as string, args.planFile as string);
          break;
        default:
          throw new Error(`Unknown command: ${command}`);
      }
      setState({ isRunning: false, error: null, output: (result as any)?.stdout ?? '' });
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setState({ isRunning: false, error: message, output: '' });
      throw err;
    } finally {
      useProjectStore.getState().setRunning(false);
    }
  }, [ipc]);

  return { ...state, run };
}
