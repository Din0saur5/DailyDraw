import { UsersRepository } from './repos.ts';

export interface DeleteAccountDeps {
  usersRepo: UsersRepository;
  currentUserId: string;
}

export const handleDeleteAccount = async (deps: DeleteAccountDeps) => {
  await deps.usersRepo.deleteUser(deps.currentUserId);
  return { ok: true };
};
