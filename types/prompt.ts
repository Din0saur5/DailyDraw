export const PROMPT_DIFFICULTIES = ['very_easy', 'easy', 'medium', 'advanced'] as const;

export type PromptDifficulty = (typeof PROMPT_DIFFICULTIES)[number];

export type DailyPromptResponse = {
  id: string;
  prompt_bank_id: string;
  prompt_text: string;
  prompt_date: string;
  difficulty: PromptDifficulty;
};

export type DailyPrompt = {
  id: string;
  promptBankId: string;
  promptText: string;
  promptDate: string;
  difficulty: PromptDifficulty;
};

export const difficultyLabels: Record<PromptDifficulty, string> = {
  very_easy: 'Very Easy',
  easy: 'Easy',
  medium: 'Medium',
  advanced: 'Advanced',
};

export function normalizeDailyPrompt(record: DailyPromptResponse): DailyPrompt {
  return {
    id: record.id,
    promptBankId: record.prompt_bank_id,
    promptText: record.prompt_text,
    promptDate: record.prompt_date,
    difficulty: record.difficulty,
  };
}
