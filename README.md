Deploy the FastAPI backend and built React app on the same HTTPS origin. The staff app is served at `/app/`, and the payer portal is served at `/pay/payment.html`. HTTPS is required for PWA installation outside localhost.

1. Copy `.env.example` to `backend/.env`, then generate a unique `SECRET_KEY` and `INITIAL_ADMIN_PASSWORD` with:
   ```sh
   sed -i \
     -e "s|^SECRET_KEY=.*|SECRET_KEY=$(openssl rand -hex 32)|" \
     -e "s|^INITIAL_ADMIN_PASSWORD=.*|INITIAL_ADMIN_PASSWORD=$(openssl rand -hex 24)|" \
     backend/.env
   ```
   If `INITIAL_ADMIN_PASSWORD` is left unset, the app falls back to `GracePath2026!` so a fresh deployment can still provision the admin account automatically. Never commit `backend/.env`.
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
