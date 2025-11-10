export type SubmissionResponse = {
  id: string;
  daily_prompt_id: string;
  user_id: string;
  caption: string | null;
  original_key: string;
  mime_type: string | null;
  width: number;
  height: number;
  is_removed: boolean;
  created_at: string;
};

export type Submission = {
  id: string;
  dailyPromptId: string;
  userId: string;
  caption: string | null;
  originalKey: string;
  mimeType: string | null;
  width: number;
  height: number;
  isRemoved: boolean;
  createdAt: string;
};

export type SubmissionUserResponse = {
  id: string;
  username: string;
  is_premium?: boolean | null;
};

export type SubmissionUser = {
  id: string;
  username: string;
  isPremium: boolean;
};

export type SubmissionWithUserResponse = SubmissionResponse & {
  user: SubmissionUserResponse;
};

export type SubmissionWithUser = Submission & {
  user: SubmissionUser;
};

export function normalizeSubmission(record: SubmissionResponse): Submission {
  return {
    id: record.id,
    dailyPromptId: record.daily_prompt_id,
    userId: record.user_id,
    caption: record.caption,
    originalKey: record.original_key,
    mimeType: record.mime_type,
    width: record.width,
    height: record.height,
    isRemoved: record.is_removed,
    createdAt: record.created_at,
  };
}

export function normalizeSubmissionWithUser(record: SubmissionWithUserResponse): SubmissionWithUser {
  return {
    ...normalizeSubmission(record),
    user: {
      id: record.user.id,
      username: record.user.username,
      isPremium: Boolean(record.user.is_premium),
    },
  };
}
