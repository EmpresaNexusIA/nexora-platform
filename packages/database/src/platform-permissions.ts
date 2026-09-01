export const PLATFORM_PERMISSIONS = {
  CONTROL_READ: "platform:control:read",
  CONTROL_MANAGE: "platform:control:manage",
  ONBOARDING: "platform:onboarding",
  RUNTIME_READ: "platform:runtime:read",
  RUNTIME_MANAGE: "platform:runtime:manage",
  BACKUP_READ: "platform:backup:read",
  EVENTS_READ: "platform:events:read",
} as const;

export type PlatformPermission =
  (typeof PLATFORM_PERMISSIONS)[keyof typeof PLATFORM_PERMISSIONS];
