import { UsersRepository } from './repos.ts';
import { validateUsername } from './validators.ts';
import { createHttpError } from './errors.ts';

export interface UsernameHandlerDeps {
  usersRepo: UsersRepository;
  currentUserId: string;
}

export interface UsernamePayload {
  username?: string;
}

export const handleSetUsername = async (deps: UsernameHandlerDeps, payload: UsernamePayload) => {
  const username = validateUsername(payload.username);
  const taken = await deps.usersRepo.isUsernameTaken(username, deps.currentUserId);
  if (taken) {
    throw createHttpError(409, 'Username already taken');
  }

  const updated = await deps.usersRepo.updateUsername(deps.currentUserId, username);
  return { username: updated.username };
};
