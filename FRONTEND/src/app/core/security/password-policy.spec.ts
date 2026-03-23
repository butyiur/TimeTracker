import {
  DEFAULT_PASSWORD_POLICY,
  calculatePasswordStrength,
  evaluatePasswordRules,
  generatePasswordByPolicy,
  passwordStrengthLabel,
  PasswordPolicyDto,
} from './password-policy';

describe('password-policy utils', () => {
  const strictPolicy: PasswordPolicyDto = {
    passwordMinLength: 10,
    passwordRequireUppercase: true,
    passwordRequireLowercase: true,
    passwordRequireDigit: true,
    passwordRequireNonAlphanumeric: true,
  };

  it('evaluatePasswordRules should include all required checks for strict policy', () => {
    const checks = evaluatePasswordRules('Abcd1234!x', strictPolicy);
    expect(checks.map(x => x.key)).toEqual(['length', 'upper', 'lower', 'digit', 'special']);
    expect(checks.every(x => x.passed)).toBe(true);
  });

  it('evaluatePasswordRules should fail missing uppercase', () => {
    const checks = evaluatePasswordRules('abcd1234!x', strictPolicy);
    const upper = checks.find(x => x.key === 'upper');
    expect(upper?.passed).toBe(false);
  });

  it('evaluatePasswordRules should fail missing lowercase', () => {
    const checks = evaluatePasswordRules('ABCD1234!X', strictPolicy);
    const lower = checks.find(x => x.key === 'lower');
    expect(lower?.passed).toBe(false);
  });

  it('evaluatePasswordRules should fail missing digit', () => {
    const checks = evaluatePasswordRules('Abcdefgh!x', strictPolicy);
    const digit = checks.find(x => x.key === 'digit');
    expect(digit?.passed).toBe(false);
  });

  it('evaluatePasswordRules should fail missing special character', () => {
    const checks = evaluatePasswordRules('Abcdefg123', strictPolicy);
    const special = checks.find(x => x.key === 'special');
    expect(special?.passed).toBe(false);
  });

  it('calculatePasswordStrength should return 0 for empty password', () => {
    const score = calculatePasswordStrength('', strictPolicy);
    expect(score).toBe(0);
  });

  it('calculatePasswordStrength should be higher for stronger password', () => {
    const weak = calculatePasswordStrength('abcd', strictPolicy);
    const strong = calculatePasswordStrength('Abcd1234!xyz', strictPolicy);
    expect(strong).toBeGreaterThan(weak);
  });

  it('passwordStrengthLabel should map score ranges', () => {
    expect(passwordStrengthLabel(10)).toBe('Nagyon gyenge');
    expect(passwordStrengthLabel(30)).toBe('Gyenge');
    expect(passwordStrengthLabel(50)).toBe('Közepes');
    expect(passwordStrengthLabel(70)).toBe('Erős');
    expect(passwordStrengthLabel(90)).toBe('Nagyon erős');
  });

  it('generatePasswordByPolicy should satisfy strict policy requirements', () => {
    const generated = generatePasswordByPolicy(strictPolicy);
    expect(generated.length).toBeGreaterThanOrEqual(strictPolicy.passwordMinLength);
    expect(/[A-Z]/.test(generated)).toBe(true);
    expect(/[a-z]/.test(generated)).toBe(true);
    expect(/[0-9]/.test(generated)).toBe(true);
    expect(/[^a-zA-Z0-9]/.test(generated)).toBe(true);
  });

  it('generatePasswordByPolicy should honor requested length when larger than minimum', () => {
    const generated = generatePasswordByPolicy(DEFAULT_PASSWORD_POLICY, 16);
    expect(generated.length).toBeGreaterThanOrEqual(16);
  });

  it('generatePasswordByPolicy should honor policy minimum when requested length is smaller', () => {
    const policy: PasswordPolicyDto = {
      ...DEFAULT_PASSWORD_POLICY,
      passwordMinLength: 14,
    };
    const generated = generatePasswordByPolicy(policy, 8);
    expect(generated.length).toBeGreaterThanOrEqual(14);
  });
});
