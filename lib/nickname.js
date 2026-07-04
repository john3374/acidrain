const MAX_NICKNAME_LENGTH = 7;
const NICKNAME_PATTERN = /^[\p{L}\p{N}_-]+$/u;

export const validateNickname = value => {
  if (typeof value !== 'string') return { valid: false, error: 'Nickname must be a string' };

  const nickname = value.trim();

  if (nickname.length === 0) return { valid: false, error: 'Nickname is required' };
  if (nickname.length > MAX_NICKNAME_LENGTH) return { valid: false, error: `Nickname must be ${MAX_NICKNAME_LENGTH} characters or fewer` };
  if (!NICKNAME_PATTERN.test(nickname)) return { valid: false, error: 'Nickname can only include letters, numbers, underscores, or hyphens' };

  return { valid: true, value: nickname };
};
