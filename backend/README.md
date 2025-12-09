# SynapStore Backend

## Setup

1.  **Environment Variables**:
    Create a `.env` file based on `.env.example` (if available) or ensure the following are set:
    ```env
    DATABASE_URL="postgresql://user:pass@localhost:5432/synapstore"
    REDIS_URL="redis://localhost:6379"
    JWT_SECRET="supersecret"
    GOOGLE_CLIENT_ID="..."
    PORT=3000
    ```

2.  **Dependencies**:
    ```bash
    npm install
    ```

3.  **Database**:
    Start Postgres and ensure the schema is applied:
    ```bash
    npx prisma generate
    npx prisma migrate dev
    ```

4.  **Redis**:
    This project requires Redis for the notification queue.
    *   **Mac (Homebrew)**: `brew install redis && brew services start redis`
    *   **Docker**: `docker run -d -p 6379:6379 --name synapstore-redis redis:alpine`

## Running

*   **API Server**:
    ```bash
    npm run dev
    ```
*   **Notification Worker**:
    ```bash
    npm run worker
    ```

## Testing

Run the end-to-end flow script:
```bash
./test-flow.sh
```
