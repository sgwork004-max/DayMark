# Manager AI Gateway

The gateway keeps the Gemini key out of the desktop application, activates customers, and enforces lifetime AI credits.

## First deployment

1. Create a free Cloudflare account and authenticate Wrangler:
   `pnpm --filter @daymark/ai-gateway exec wrangler login`
2. Create the database:
   `pnpm --filter @daymark/ai-gateway exec wrangler d1 create manager-ai`
3. Copy the returned database ID into `wrangler.toml`.
4. Apply the schema:
   `pnpm --filter @daymark/ai-gateway db:remote`
5. Add secrets:
   `pnpm --filter @daymark/ai-gateway exec wrangler secret put GEMINI_API_KEY`
   `pnpm --filter @daymark/ai-gateway exec wrangler secret put ADMIN_TOKEN`
6. Deploy:
   `pnpm --filter @daymark/ai-gateway deploy`

Set `VITE_MANAGER_AI_GATEWAY_URL` to the deployed `workers.dev` URL before building Manager. The endpoint can also be entered in the app's advanced AI settings during private beta testing.

## Issue a customer activation

Use a long random value for `ADMIN_TOKEN`, then run:

```bash
curl -X POST "https://YOUR-WORKER.workers.dev/v1/admin/licenses" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"label":"Customer name","creditLimit":300,"maxDevices":2}'
```

The response contains the activation code shown to the customer. The gateway stores only a hash of that code.

## Privacy and operations

- Note text is sent to Google only when the customer invokes an AI action.
- Prompts and note content are not stored by this gateway.
- Usage events retain only character counts, model, customer license ID, and timestamp.
- Failed upstream requests automatically refund the reserved credit.
- Revoke a license with `POST /v1/admin/licenses/revoke` and `{ "id": "LICENSE_ID" }`.
