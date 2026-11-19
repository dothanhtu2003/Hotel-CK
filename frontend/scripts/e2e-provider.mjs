import { PayOS } from '@payos/node';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
// Only the provider SDK transport is simulated. PayosService, controllers,
// reconciliation, idempotency and PostgreSQL guards execute unchanged.
export function providerClient(statePath) {
  writeFileSync(statePath, '{}');
  const links = new Map();
  const verifier = new PayOS({ clientId:'e2e-only', apiKey:'e2e-only', checksumKey:'e2e-checksum-never-production' });
  return {
    webhooks: verifier.webhooks,
    paymentRequests: {
      create: async data => {
        const link = { ...data, id:randomUUID().replaceAll('-',''), amountPaid:0, amountRemaining:data.amount, status:'PENDING', currency:'VND', qrCode:'000201-E2E-PROVIDER-QR', accountNumber:'0123456789', accountName:'E2E HOTEL', bin:'970422', description:data.description, checkoutUrl:`https://pay.payos.vn/web/e2e-${data.orderCode}` };
        links.set(data.orderCode,link); return link;
      },
      get: async code => {
        const link=links.get(code); if(!link) throw new Error('Unknown simulated provider order');
        const state=JSON.parse(readFileSync(statePath,'utf8'))[String(code)];
        return state ? { ...link, ...state } : link;
      },
      cancel: async code => { const link=links.get(code); if(!link) throw new Error('Unknown simulated provider order'); link.status='CANCELLED';return link; },
    },
  };
}
