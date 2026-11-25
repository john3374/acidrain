import { describe, expect, test } from 'vitest';

import { validateNickname } from './nickname.js';

describe('validateNickname', () => {
  test.each(['산성비', 'acid_1', '사용자_a-Z', '가a1'])('accepts %s', nickname => {
    expect(validateNickname(nickname)).toEqual({ valid: true, value: nickname });
  });

  test.each([
    ['аdmin', 'a Cyrillic letter that looks Latin'],
    ['ｓａｍｅ', 'fullwidth Latin'],
    ['漢字', 'Han characters'],
    ['a b', 'a space'],
    ['', 'nothing'],
    ['12345678', 'eight characters'],
  ])('rejects %s (%s)', nickname => {
    expect(validateNickname(nickname).valid).toBe(false);
  });
});
