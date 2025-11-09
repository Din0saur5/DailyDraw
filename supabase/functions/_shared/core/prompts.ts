import { PromptsRepository, DailyPromptRecord } from './repos.ts';
import { utcDayRange } from './time.ts';

const DIFFICULTY_ORDER = ['very_easy', 'easy', 'medium', 'advanced'];

export interface PromptsDeps {
  promptsRepo: PromptsRepository;
  now?: () => Date;
}

export const handlePromptsToday = async (deps: PromptsDeps) => {
  const { start, end } = utcDayRange(deps.now ? deps.now() : new Date());
  const items = await deps.promptsRepo.findWithinRange(start.toISOString(), end.toISOString());
  return items.sort((a, b) => {
    const diff = DIFFICULTY_ORDER.indexOf(a.difficulty) - DIFFICULTY_ORDER.indexOf(b.difficulty);
    if (diff !== 0) return diff;
    return (a.prompt_text || '').localeCompare(b.prompt_text);
  });
};

export type PromptsTodayResponse = DailyPromptRecord[];
