import { createHttpError } from '../core/errors.ts';
import type {
  DailyPromptRecord,
  PromptsRepository,
  ReportsRepository,
  SubmissionRecord,
  SubmissionUpsertInput,
  SubmissionWithUser,
  SubmissionsRepository,
  UsersRepository,
} from '../core/repos.ts';

type SupabaseClient = ReturnType<typeof createSupabaseStub>;

// Placeholder to satisfy TypeScript when this module is type-checked in editors.
// The actual client is created in supabaseClient.ts and matches this shape.
function createSupabaseStub(): any {
  return {};
}

const unwrap = <T>(response: { data: T | null; error: any }) => {
  if (response.error) {
    throw createHttpError(500, response.error.message ?? 'Supabase query failed', response.error);
  }
  if (response.data === null) {
    throw createHttpError(404, 'Requested resource not found');
  }
  return response.data;
};

export const createRepositories = (client: SupabaseClient) => {
  const usersRepo: UsersRepository = {
    async isUsernameTaken(username, excludeUserId) {
      const { data, error } = await client
        .from('users')
        .select('id')
        .ilike('username', username)
        .neq('id', excludeUserId)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') {
        throw createHttpError(500, error.message ?? 'Failed checking username');
      }
      return Boolean(data);
    },
    async updateUsername(userId, username) {
      const data = unwrap(
        await client
          .from('users')
          .update({ username })
          .eq('id', userId)
          .select('id, username')
          .single(),
      );
      return data;
    },
  };

  const promptsRepo: PromptsRepository = {
    async findWithinRange(startIso, endIso) {
      const { data, error } = await client
        .from('daily_prompts')
        .select('*')
        .gte('prompt_date', startIso)
        .lt('prompt_date', endIso)
        .order('difficulty');
      if (error) {
        throw createHttpError(500, error.message ?? 'Failed to fetch prompts');
      }
      return (data ?? []) as DailyPromptRecord[];
    },
  };

  const submissionsRepo: SubmissionsRepository = {
    async upsertSubmission(payload: SubmissionUpsertInput) {
      const data = unwrap(
        await client
          .from('submissions')
          .upsert(
            {
              daily_prompt_id: payload.dailyPromptId,
              user_id: payload.userId,
              original_key: payload.key,
              caption: payload.caption,
              width: payload.width,
              height: payload.height,
              mime_type: payload.mime,
            },
            { onConflict: 'daily_prompt_id,user_id' },
          )
          .select(
            'id,daily_prompt_id,user_id,caption,original_key,mime_type,width,height,is_removed,created_at',
          )
          .single(),
      );
      return data as SubmissionRecord;
    },
    async findByStorageKey(key: string) {
      const { data, error } = await client
        .from('submissions')
        .select(
          'id,daily_prompt_id,user_id,caption,original_key,mime_type,width,height,is_removed,created_at',
        )
        .eq('original_key', key)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') {
        throw createHttpError(500, error.message ?? 'Failed to lookup submission');
      }
      return (data as SubmissionRecord | null) ?? null;
    },
    async listFeed({ dailyPromptId, limit, cursor }) {
      let query = client
        .from('submissions')
        .select(
          'id,daily_prompt_id,user_id,caption,original_key,mime_type,width,height,is_removed,created_at,user:user_public(id,username,is_premium)',
        )
        .eq('daily_prompt_id', dailyPromptId)
        .eq('is_removed', false);

      if (cursor) {
        query = query.lt('created_at', cursor);
      }

      const { data, error } = await query.order('created_at', { ascending: false }).limit(limit);
      if (error) {
        throw createHttpError(500, error.message ?? 'Failed to load feed');
      }
      return (data ?? []) as SubmissionWithUser[];
    },
  };

  const reportsRepo: ReportsRepository = {
    async createReport(payload) {
      const { error } = await client.from('reports').insert({
        submission_id: payload.submissionId,
        reporter_id: payload.reporterId,
        reason: payload.reason,
      });
      if (error) {
        throw createHttpError(500, error.message ?? 'Failed to submit report');
      }
    },
  };

  return {
    users: usersRepo,
    prompts: promptsRepo,
    submissions: submissionsRepo,
    reports: reportsRepo,
  };
};
