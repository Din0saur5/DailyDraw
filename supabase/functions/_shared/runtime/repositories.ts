import { createHttpError } from '../core/errors.ts';
import type {
  DailyPromptRecord,
  PremiumMetadataInput,
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
    async updatePremiumMetadata(payload: PremiumMetadataInput) {
      const { error } = await client
        .from('users')
        .update({
          is_premium: payload.isPremium,
          apple_product_id: payload.appleProductId ?? null,
          apple_latest_transaction_id: payload.appleLatestTransactionId ?? null,
          apple_environment: payload.appleEnvironment ?? null,
          premium_expires_at: payload.premiumExpiresAt ?? null,
        })
        .eq('id', payload.userId);
      if (error) {
        throw createHttpError(
          500,
          error.message ?? 'Failed to update premium metadata',
          error,
        );
      }
    },
    async deleteUser(userId) {
      const { data: submissionRows, error: submissionLookupError } = await client
        .from('submissions')
        .select('id')
        .eq('user_id', userId);
      if (submissionLookupError) {
        throw createHttpError(
          500,
          submissionLookupError.message ?? 'Failed to load user submissions',
          submissionLookupError,
        );
      }
      const submissionIds = (submissionRows ?? []).map((row: { id: string | number }) =>
        row.id.toString(),
      );

      const { error: reportError } = await client.from('reports').delete().eq('reporter_id', userId);
      if (reportError) {
        throw createHttpError(
          500,
          reportError.message ?? 'Failed to delete user reports',
          reportError,
        );
      }

      if (submissionIds.length > 0) {
        const { error: reportedSubmissionsError } = await client
          .from('reports')
          .delete()
          .in('submission_id', submissionIds);
        if (reportedSubmissionsError) {
          throw createHttpError(
            500,
            reportedSubmissionsError.message ?? 'Failed to delete reports tied to submissions',
            reportedSubmissionsError,
          );
        }
      }

      const { error: submissionError } = await client.from('submissions').delete().eq('user_id', userId);
      if (submissionError) {
        throw createHttpError(
          500,
          submissionError.message ?? 'Failed to delete user submissions',
          submissionError,
        );
      }

      const { error: profileError } = await client.from('users').delete().eq('id', userId);
      if (profileError) {
        throw createHttpError(
          500,
          profileError.message ?? 'Failed to delete user profile',
          profileError,
        );
      }

      const { error: authError } = await client.auth.admin.deleteUser(userId);
      if (authError && authError.status !== 404) {
        throw createHttpError(
          500,
          authError.message ?? 'Failed to delete user account',
          authError,
        );
      }
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
