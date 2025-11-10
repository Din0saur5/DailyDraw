import { Submission } from '@/types/submission';
import { PromptDifficulty, difficultyLabels } from '@/types/prompt';

export type LibraryPrompt = {
  id: string;
  promptText: string;
  promptDate: string;
  difficulty: PromptDifficulty;
};

export type LibraryEntry = Submission & {
  prompt: LibraryPrompt | null;
};

type LibraryRow = {
  id: number | string;
  daily_prompt_id: string;
  user_id: string;
  caption: string | null;
  original_key: string;
  mime_type: string | null;
  width: number;
  height: number;
  is_removed: boolean;
  created_at: string;
  daily_prompt: {
    id: string;
    prompt_text: string;
    prompt_date: string;
    difficulty: PromptDifficulty;
  } | null;
};

export const normalizeLibraryRow = (row: LibraryRow): LibraryEntry => {
  return {
    id: row.id?.toString(),
    dailyPromptId: row.daily_prompt_id,
    userId: row.user_id,
    caption: row.caption,
    originalKey: row.original_key,
    mimeType: row.mime_type,
    width: row.width,
    height: row.height,
    isRemoved: row.is_removed,
    createdAt: row.created_at,
    prompt: row.daily_prompt
      ? {
          id: row.daily_prompt.id,
          promptText: row.daily_prompt.prompt_text,
          promptDate: row.daily_prompt.prompt_date,
          difficulty: row.daily_prompt.difficulty,
        }
      : null,
  };
};

export const formatPromptLabel = (entry: LibraryEntry) => {
  if (!entry.prompt) return 'Daily prompt';
  return `${difficultyLabels[entry.prompt.difficulty]} · ${formatPromptDate(entry.prompt.promptDate)}`;
};

const formatPromptDate = (isoDate: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(isoDate));
