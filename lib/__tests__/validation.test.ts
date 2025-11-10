import { validateUsernameInput } from '@/lib/validation';

describe('validateUsernameInput', () => {
  it('rejects empty usernames', () => {
    expect(validateUsernameInput('   ')).toMatch(/required/i);
  });

  it('rejects invalid characters', () => {
    expect(validateUsernameInput('bad-name!')).toMatch(/letters/i);
  });

  it('rejects short usernames', () => {
    expect(validateUsernameInput('ab')).toMatch(/3-20/i);
  });

  it('accepts valid usernames', () => {
    expect(validateUsernameInput('artist_one')).toBeNull();
  });
});
