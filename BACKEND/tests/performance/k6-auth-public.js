import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = __ENV.K6_BASE_URL || 'https://localhost:7037';

export const options = {
  scenarios: {
    auth_public_smoke: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '20s', target: 10 },
        { duration: '40s', target: 30 },
        { duration: '20s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<600', 'avg<300'],
  },
  insecureSkipTLSVerify: true,
};

export default function () {
  const policyRes = http.get(`${baseUrl}/api/auth/password-policy`);
  check(policyRes, {
    'password-policy status 200': r => r.status === 200,
    'password-policy has min length': r => r.json('passwordMinLength') !== null,
  });

  const resendRes = http.post(
    `${baseUrl}/api/auth/resend-email-confirmation`,
    JSON.stringify({ email: 'nobody@example.com' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  check(resendRes, {
    'resend-email-confirmation status 200': r => r.status === 200,
  });

  sleep(0.4);
}
