export interface UserRecord {
  id: string;
  username: string;
  is_premium?: boolean;
}

export interface PromptsRepository {
  findWithinRange(startIso: string, endIso: string): Promise<DailyPromptRecord[]>;
}

export interface UsersRepository {
  isUsernameTaken(username: string, excludeUserId: string): Promise<boolean>;
  updateUsername(userId: string, username: string): Promise<{} | undefined>;
  deleteUser(userId: string): Promise<void>;
  updatePremiumMetadata(payload: PremiumMetadataInput): Promise<void>;
}

export interface PremiumMetadataInput {
  userId: string;
  isPremium: boolean;
  appleProductId?: string | null;
  appleLatestTransactionId?: string | null;
  appleEnvironment?: string | null;
  premiumExpiresAt?: string | null;
}

export interface SubmissionsRepository {
  upsertSubmission(payload: SubmissionUpsertInput): Promise<SubmissionRecord>;
  findByStorageKey(key: string): Promise<SubmissionRecord | null>;
  listFeed(params: {
    dailyPromptId: string;
    limit: number;
    cursor?: string;
  }): Promise<SubmissionWithUser[]>;
}

export interface ReportsRepository {
  createReport(payload: {
    submissionId: string;
    reporterId: string;
    reason: string;
  }): Promise<void>;
}

export interface DailyPromptRecord {
  id: string;
  prompt_bank_id: string;
  prompt_text: string;
  prompt_date: string;
  difficulty: string;
  created_at?: string;
}

export interface SubmissionRecord {
  id: string;
  daily_prompt_id: string;
  user_id: string;
  caption: string | null;
  original_key: string;
  mime_type?: string | null;
  width: number;
  height: number;
  is_removed: boolean;
  created_at: string;
  user?: UserRecord;
}

export interface SubmissionWithUser extends SubmissionRecord {
  user: UserRecord;
}

export interface SubmissionUpsertInput {
  dailyPromptId: string;
  key: string;
  caption: string | null;
  width: number;
  height: number;
  mime?: string | null;
  userId: string;
}
