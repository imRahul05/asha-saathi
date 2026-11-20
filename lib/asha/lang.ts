// Shared UI types for the voice screen. All user-facing text lives in lib/i18n.

export type OrbState =
  | 'joining'
  | 'not-joined'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'muted'
  | 'disconnected';
