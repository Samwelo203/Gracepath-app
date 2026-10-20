# Grace Path Centre Management System

## Production deployment

Deploy the FastAPI backend and built React app on the same HTTPS origin. The staff app is served at `/app/`, and the payer portal is served at `/pay/payment.html`. HTTPS is required for PWA installation outside localhost.

1. Copy `.env.example` to `backend/.env` and set a unique `SECRET_KEY` (at least 32 characters), a unique `INITIAL_ADMIN_PASSWORD` (at least 16 characters, needed only when provisioning an empty database), the public `ALLOWED_ORIGINS`, and payment-provider credentials/callback URLs. Never commit `backend/.env`.
2. Build the image: `docker build -t grace-path-centre .`.
3. Run it with HTTPS termination at the hosting platform and a persistent database volume:
   ```sh
   docker run --name grace-path-centre \
     --env-file backend/.env \
     -e DATABASE_URL=sqlite:////data/gracepath.db \
     -p 8000:8000 \
     -v gracepath-data:/data \
     grace-path-centre
   ```

4. Configure M-Pesa's callback as `/api/payments/mpesa/callback`, Equity IPN as `/api/payments/equity/callback` with its Basic Auth credentials, and Equity push callback as `/api/payments/equity/push-callback/{EQUITY_PUSH_CALLBACK_TOKEN}`.
5. Verify `/health`, `/app/`, `/app/manifest.webmanifest`, `/app/sw.js`, `/pay/payment.html`, and the payment-provider callback URLs before inviting staff. Keep the database volume persistent and schedule backups.

The service worker precaches the staff application shell and static assets only. It does not cache API responses or patient/payment data. An installed app still needs a network connection to authenticate and use the management system.

## Install the staff app

Open `/app/` in a supported browser over HTTPS and choose **Install App** in the sidebar. Chrome and Edge can open the native install prompt; Safari users can follow the Add to Home Screen instructions. On desktop browsers without a prompt, use the browser menu's install option.

## Local development

Run the backend from `backend/` with `uvicorn app.main:app --reload`, then run `npm run dev` from `frontend/`. The Vite server proxies API requests to `http://127.0.0.1:8000`.