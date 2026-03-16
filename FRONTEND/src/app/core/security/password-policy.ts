export type PasswordPolicyDto = {
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireDigit: boolean;
  passwordRequireNonAlphanumeric: boolean;
};

export type PasswordRuleCheck = {
  key: string;
  label: string;
  passed: boolean;
};

export const DEFAULT_PASSWORD_POLICY: PasswordPolicyDto = {
  passwordMinLength: 8,
  passwordRequireUppercase: false,
  passwordRequireLowercase: false,
  passwordRequireDigit: false,
  passwordRequireNonAlphanumeric: false,
};

export function evaluatePasswordRules(password: string, policy: PasswordPolicyDto): PasswordRuleCheck[] {
  const value = password ?? '';

  const checks: PasswordRuleCheck[] = [
    {
      key: 'length',
      label: `Legalább ${policy.passwordMinLength} karakter`,
      passed: value.length >= policy.passwordMinLength,
    },
  ];

  if (policy.passwordRequireUppercase) {
    checks.push({
      key: 'upper',
      label: 'Legalább 1 nagybetű',
      passed: /[A-Z]/.test(value),
    });
  }

  if (policy.passwordRequireLowercase) {
    checks.push({
      key: 'lower',
      label: 'Legalább 1 kisbetű',
      passed: /[a-z]/.test(value),
    });
  }

  if (policy.passwordRequireDigit) {
    checks.push({
      key: 'digit',
      label: 'Legalább 1 szám',
      passed: /[0-9]/.test(value),
    });
  }

  if (policy.passwordRequireNonAlphanumeric) {
    checks.push({
      key: 'special',
      label: 'Legalább 1 speciális karakter',
      passed: /[^a-zA-Z0-9]/.test(value),
    });
  }

  return checks;
}

export function calculatePasswordStrength(password: string, policy: PasswordPolicyDto): number {
  const value = password ?? '';
  if (!value.length) return 0;

  const checks = evaluatePasswordRules(value, policy);
  const passedChecks = checks.filter(x => x.passed).length;
  const checkRatio = checks.length ? passedChecks / checks.length : 0;

  let diversity = 0;
  if (/[a-z]/.test(value)) diversity += 1;
  if (/[A-Z]/.test(value)) diversity += 1;
  if (/[0-9]/.test(value)) diversity += 1;
  if (/[^a-zA-Z0-9]/.test(value)) diversity += 1;

  const diversityRatio = diversity / 4;
  const lengthRatio = Math.min(value.length / Math.max(policy.passwordMinLength + 4, 12), 1);

  const weighted = (checkRatio * 0.6) + (diversityRatio * 0.2) + (lengthRatio * 0.2);
  return Math.max(0, Math.min(100, Math.round(weighted * 100)));
}

export function passwordStrengthLabel(score: number): string {
  if (score >= 85) return 'Nagyon erős';
  if (score >= 65) return 'Erős';
  if (score >= 45) return 'Közepes';
  if (score >= 20) return 'Gyenge';
  return 'Nagyon gyenge';
}

export function generatePasswordByPolicy(policy: PasswordPolicyDto, requestedLength?: number): string {
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  const special = '!@#$%^&*()-_=+[]{};:,.?/';

  const requiredSets: string[] = [];
  const optionalSets: string[] = [];

  optionalSets.push(lower, upper, digits);

  if (policy.passwordRequireLowercase) requiredSets.push(lower);
  if (policy.passwordRequireUppercase) requiredSets.push(upper);
  if (policy.passwordRequireDigit) requiredSets.push(digits);
  if (policy.passwordRequireNonAlphanumeric) {
    requiredSets.push(special);
    optionalSets.push(special);
  }

  const minLength = Math.max(policy.passwordMinLength, requiredSets.length || 1);
  const finalLength = Math.max(minLength, requestedLength ?? minLength);

  const allChars = Array.from(new Set(optionalSets.join('').split(''))).join('') || `${lower}${upper}${digits}${special}`;

  const pick = (source: string) => source[Math.floor(Math.random() * source.length)];

  const chars: string[] = [];
  for (const set of requiredSets) {
    chars.push(pick(set));
  }

  while (chars.length < finalLength) {
    chars.push(pick(allChars));
  }

  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const temp = chars[index];
    chars[index] = chars[swapIndex];
    chars[swapIndex] = temp;
  }

  return chars.join('');
}
