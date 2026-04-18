import React from 'react';

export default function Quickstart() {
  return (
    <>
      <div className="mb-2 text-[11px] font-semibold tracking-wider text-blue-600 dark:text-indigo-400 uppercase">
        Overview
      </div>
      <h1 className="leading-tight">Quickstart & Integration</h1>
      
      <p>
        Get SentinelClear running locally and initiate your first atomic transfer in under five minutes. SentinelClear relies on Docker to orchestrate its microservices architecture.
      </p>

      <h2>1. Environment Setup</h2>
      <p>
        Make sure you have <a href="https://www.docker.com/" target="_blank" rel="noreferrer">Docker Desktop</a> installed and running. SentinelClear uses Docker Compose to link the FastAPI backend, PostgreSQL database, Redis cache, RabbitMQ broker, and Nginx frontend.
      </p>

      <pre><code>{`# Clone the repository
git clone https://github.com/sahil8017/SentinelClear.git
cd SentinelClear

# Build and start all services
docker-compose up -d --build`}</code></pre>

      <p>
        Once containers are running, Alembic migrations run automatically via <code>alembic upgrade head</code> to configure your database schema.
      </p>

      <h2>2. Access the Application</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
        <div className="p-4 border border-zinc-200 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-[#0c0c0d]">
          <h4 className="!mt-0 !mb-2 !text-sm font-bold">Frontend UI</h4>
          <p className="!text-sm !my-0"><code>http://localhost</code> — Landing page, auth, and all user dashboards</p>
        </div>
        <div className="p-4 border border-zinc-200 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-[#0c0c0d]">
          <h4 className="!mt-0 !mb-2 !text-sm font-bold">API Gateway</h4>
          <p className="!text-sm !my-0"><code>http://localhost:8000/api</code> — All REST endpoints</p>
        </div>
        <div className="p-4 border border-zinc-200 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-[#0c0c0d]">
          <h4 className="!mt-0 !mb-2 !text-sm font-bold">Swagger Docs</h4>
          <p className="!text-sm !my-0"><code>http://localhost:8000/docs</code> — Interactive OpenAPI explorer</p>
        </div>
        <div className="p-4 border border-zinc-200 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-[#0c0c0d]">
          <h4 className="!mt-0 !mb-2 !text-sm font-bold">Grafana Metrics</h4>
          <p className="!text-sm !my-0"><code>http://localhost:3000</code> — admin/admin</p>
        </div>
      </div>

      <h2>3. Register & Authenticate</h2>
      <p>
        SentinelClear uses JWT authentication. Register a user through the UI or API:
      </p>

      <pre><code>{`# Register a new user
curl -X POST http://localhost:8000/api/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "username": "johndoe",
    "email": "john@example.com",
    "password": "securepassword123"
  }'

# Login to get JWT token
curl -X POST http://localhost:8000/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "username": "johndoe",
    "password": "securepassword123"
  }'
# Returns: { "access_token": "eyJ...", "token_type": "bearer" }`}</code></pre>

      <h2>4. Initiate Your First Transfer</h2>
      <p>
        Transfers require an <code>Idempotency-Key</code> header — a UUID you generate on your client. If the request drops and you retry with the same key, SentinelClear guarantees the transfer only occurs once.
      </p>

      <pre><code>{`curl -X POST http://localhost:8000/api/transfers \\
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \\
  -H "Idempotency-Key: 123e4567-e89b-12d3-a456-426614174000" \\
  -H "Content-Type: application/json" \\
  -d '{
    "receiver_account_id": "RECIPIENT_UUID",
    "amount": 1000.50,
    "reference": "Test payment"
  }'`}</code></pre>

      <p>
        If successful, you'll receive a <code>201 Created</code> response. The rule engine evaluates the risk score synchronously — if it exceeds the block threshold, the transfer is immediately <code>"status": "FLAGGED"</code> and rolled back.
      </p>

      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 rounded-xl my-6">
        <strong className="text-blue-800 dark:text-blue-300">Tip:</strong> After registering, visit <code>/app/profile-setup</code> to complete your profile and set a transaction PIN for step-up authentication on high-value transfers.
      </div>

      <h2>5. Default Admin Credentials</h2>
      <p>
        The system seeds a default admin account on first run. Use it to access the Operations Dashboard and manage fraud rules:
      </p>
      <pre><code>{`Username: admin
Password: admin123
Role: ADMIN`}</code></pre>

      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-xl my-6">
        <strong className="text-amber-800 dark:text-amber-300">Warning:</strong> Change the default admin password immediately in production environments.
      </div>
    </>
  );
}
