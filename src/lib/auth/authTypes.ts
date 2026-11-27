// Centralized Authentication Types for AgencyOS
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface LoginResult {
  token: string;
  user: AuthUser;
  mustChange: boolean;
}

export interface SessionRecord {
  id: string;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
  last_seen: string;
  revoked_at: string | null;
  current?: boolean;
}

export interface UserSecurityProfile {
  mustChangePassword: boolean;
  passwordUpdatedAt: string | null;
  mfaEnabled: boolean;
}

export interface ProfileResponse {
  profile: Record<string, any>;
  security: UserSecurityProfile;
  sessions: SessionRecord[];
  loginHistory: any[];
}
