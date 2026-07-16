# ngenius-orabank-vercel

Serverless API project for N-Genius / Orabank (sandbox) integrated with Firebase Firestore.

Key endpoints:
- POST /api/create-payment  -> create an order
- POST /api/webhook         -> receive payment notifications
- GET  /api/health          -> health check

Steps after cloning:
1. Set environment variables on Vercel (do NOT commit secrets).
2. npm install
3. vercel deploy or vercel dev

See .env.example for required variables.
