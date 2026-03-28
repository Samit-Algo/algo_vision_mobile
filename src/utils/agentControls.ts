/**
 * Maps backend `AgentResponse.status` to which controls to show on the detail screen.
 * Paused → Resume + Stop; monitoring-like → Pause + Stop; terminal → none.
 */
export type AgentControlMode = 'pause_stop' | 'paused_resume_stop' | 'none';

export function getAgentControlUi(statusRaw: string | undefined | null): {
  mode: AgentControlMode;
  /** When paused, show this status label near the buttons */
  pausedLabel?: string;
} {
  const s = String(statusRaw ?? '')
    .toLowerCase()
    .trim();

  if (s === 'paused') {
    return {mode: 'paused_resume_stop', pausedLabel: 'Paused'};
  }

  if (
    s === 'complete' ||
    s === 'completed' ||
    s === 'inactive' ||
    s === 'stopped' ||
    s === 'expired' ||
    s === 'cancelled'
  ) {
    return {mode: 'none'};
  }

  if (
    s === 'monitoring' ||
    s === 'scheduled' ||
    s === 'sleeping' ||
    s === 'active' ||
    s === 'running'
  ) {
    return {mode: 'pause_stop'};
  }

  return {mode: 'none'};
}
