/** @jest-environment node */

import { handleSetUsername } from '../_shared/core/username.ts';
import { handleUploadSign } from '../_shared/core/uploads.ts';
import { handleSubmissionUpsert } from '../_shared/core/submissions.ts';
import { handleImageSignGet } from '../_shared/core/images.ts';
import { handlePromptsToday } from '../_shared/core/prompts.ts';
import { handleFeedRequest } from '../_shared/core/feed.ts';
import { handleReportCreate } from '../_shared/core/reports.ts';
import { HttpError } from '../_shared/core/errors.ts';

describe('Edge function core handlers', () => {
  it('updates username when available', async () => {
    const usersRepo = {
      isUsernameTaken: jest.fn().mockResolvedValue(false),
      updateUsername: jest.fn().mockResolvedValue({ id: 'user1', username: 'artist_one' }),
    };

    const result = await handleSetUsername(
      { usersRepo, currentUserId: 'user1' },
      { username: 'artist_one' },
    );

    expect(result).toEqual({ username: 'artist_one' });
    expect(usersRepo.isUsernameTaken).toHaveBeenCalledWith('artist_one', 'user1');
    expect(usersRepo.updateUsername).toHaveBeenCalled();
  });

  it('rejects duplicate username', async () => {
    const usersRepo = {
      isUsernameTaken: jest.fn().mockResolvedValue(true),
      updateUsername: jest.fn(),
    };

    await expect(
      handleSetUsername({ usersRepo, currentUserId: 'user1' }, { username: 'artist_one' }),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it('rejects upload over 10MB', async () => {
    const signer = { signPutObject: jest.fn() };
    await expect(
      handleUploadSign(
        {
          signer,
          currentUserId: 'user1',
          now: () => new Date('2024-01-01T00:00:00Z'),
          uuid: () => 'abc',
        },
        { ext: 'jpg', size: 15 * 1024 * 1024 },
      ),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it('requires positive dimensions when creating submission', async () => {
    const submissionsRepo = { upsertSubmission: jest.fn() };
    await expect(
      handleSubmissionUpsert(
        { submissionsRepo, currentUserId: 'user1' },
        {
          dailyPromptId: '00000000-0000-4000-8000-000000000000',
          key: 'orig',
          width: 0,
          height: 0,
        },
      ),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it('returns upserted submission so UI can surface replacements', async () => {
    const submissionsRepo = {
      upsertSubmission: jest.fn().mockResolvedValue({
        id: 'sub',
        daily_prompt_id: 'prompt',
        user_id: 'user1',
        caption: 'updated caption',
        original_key: 'orig/new-key',
        mime_type: 'image/jpeg',
        width: 1024,
        height: 768,
        is_removed: false,
        created_at: '2024-01-01T00:00:00Z',
      }),
    };

    const payload = {
      dailyPromptId: '00000000-0000-4000-8000-000000000000',
      key: 'orig/new-key',
      caption: 'updated caption',
      width: 1024,
      height: 768,
      mime: 'image/jpeg',
    };

    const result = await handleSubmissionUpsert(
      { submissionsRepo, currentUserId: 'user1' },
      payload,
    );

    expect(result.original_key).toEqual('orig/new-key');
    expect(submissionsRepo.upsertSubmission).toHaveBeenCalledWith({
      ...payload,
      userId: 'user1',
    });
  });

  it('blocks removed submissions for non-owners when signing GET', async () => {
    const submissionsRepo = {
      findByStorageKey: jest.fn().mockResolvedValue({
        id: 'sub',
        daily_prompt_id: 'prompt',
        user_id: 'someoneelse',
        caption: null,
        original_key: 'orig',
        mime_type: null,
        width: 100,
        height: 100,
        is_removed: true,
        created_at: new Date().toISOString(),
      }),
    };
    const signer = { signGetObject: jest.fn() };

    await expect(
      handleImageSignGet({ submissionsRepo, signer, currentUserId: 'user1' }, 'orig'),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it('sorts prompts by difficulty order', async () => {
    const promptsRepo = {
      findWithinRange: jest.fn().mockResolvedValue([
        {
          id: '3',
          prompt_bank_id: 'a',
          prompt_text: 'medium',
          prompt_date: '2024-01-01',
          difficulty: 'medium',
        },
        {
          id: '1',
          prompt_bank_id: 'a',
          prompt_text: 'easy',
          prompt_date: '2024-01-01',
          difficulty: 'easy',
        },
      ]),
    };

    const result = await handlePromptsToday({
      promptsRepo,
      now: () => new Date('2024-01-01T12:00:00Z'),
    });
    expect(result.map((p) => p.difficulty)).toEqual(['easy', 'medium']);
  });

  it('requires dailyPromptId for feed', async () => {
    const submissionsRepo = { listFeed: jest.fn() };
    await expect(handleFeedRequest({ submissionsRepo }, {})).rejects.toBeInstanceOf(HttpError);
  });

  it('validates report reason length', async () => {
    const reportsRepo = { createReport: jest.fn() };
    await expect(
      handleReportCreate(
        { reportsRepo, currentUserId: 'user1' },
        { submissionId: '00000000-0000-4000-8000-000000000000', reason: 'no' },
      ),
    ).rejects.toBeInstanceOf(HttpError);
  });
});
