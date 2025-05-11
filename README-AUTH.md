# Authentication System Documentation

This document explains the authentication system for the Imgenhancify application, how to run the application, and how to test the authentication flow.

## How the Authentication System Works

The authentication system is a simple token-based mechanism using Prisma and a PostgreSQL database.

1.  **Signup**:

    - A user requests to sign up.
    - The system generates a unique authentication code (UUID v4) using the `signUp` server action defined in `frontend/src/app/actions/auth.ts`.
    - This `authCode` is stored in the `User` table in the database.
    - The `authCode` is returned to the user. This code acts as a temporary credential.
    - **API Endpoint (Assumed)**: `POST /api/auth/signup`
      - Request: (No body needed)
      - Success Response: `{ "authCode": "your-unique-auth-code" }`
      - Error Response: `{ "error": "Error message" }`

2.  **Login**:
    - The user provides the `authCode` they received during signup.
    - The system checks if the provided `authCode` exists in the `User` table using the `logIn` server action, also in `frontend/src/app/actions/auth.ts`.
    - If the `authCode` is valid, the login is considered successful, and the system can then establish a session or return user details (currently returns `success: true` and `userId`).
    - If the `authCode` is invalid or not found, the login fails.
    - **API Endpoint (Assumed)**: `POST /api/auth/login`
      - Request: `{ "authCode": "user-provided-auth-code" }`
      - Success Response: `{ "success": true, "userId": 123 }`
      - Error Response: `{ "error": "Invalid authentication code." }`

**Database Schema (`prisma/schema.prisma` excerpt):**

```prisma
model User {
  id        Int      @id @default(autoincrement())
  authCode  String   @unique
  createdAt DateTime @default(now())
  // Add other user fields as needed
}
```

## Running the Application

The application and its PostgreSQL database are containerized using Docker.

1.  **Prerequisites**:

    - Docker and Docker Compose installed.
    - Ensure your `.env` file (e.g., `frontend/.env`) is correctly configured, especially the `DATABASE_URL` for Prisma to connect to the PostgreSQL container. Example:
      ```env
      DATABASE_URL="postgresql://user:password@db:5432/mydb?schema=public"
      ```

2.  **Start the Services**:
    Open your terminal in the project root directory (where `docker-compose.yml` is located) and run:

    ```bash
    docker compose up
    ```

    To run in detached mode (in the background):

    ```bash
    docker compose up -d
    ```

    This command will:

    - Build the Docker images if they don't exist (e.g., for the `frontend` service).
    - Start the `frontend` application container.
    - Start the `db` (PostgreSQL) container.
    - Apply Prisma migrations automatically if the `frontend` service's entrypoint or command is configured to do so (common practice).

3.  **Accessing the Application**:
    Once the services are running, the frontend application should be accessible at `http://localhost:3000` (or the port configured in your `docker-compose.yml` and Next.js app).

4.  **Stopping the Services**:
    To stop the running services:
    ```bash
    docker compose down
    ```
    This will stop and remove the containers. Add `-v` to remove volumes (e.g., database data): `docker compose down -v`.

## Manually Testing the Authentication System

You can manually test the authentication endpoints using a tool like `curl` or Postman. Ensure the application is running (`docker compose up`).

**1. Test Signup:**

- **Command:**
  ```bash
  curl -X POST http://localhost:3000/api/auth/signup
  ```
- **Expected Success Response:**
  ```json
  {
    "authCode": "a-unique-generated-auth-code"
  }
  ```
  Copy the `authCode` value.
- **Expected Error Response (Example):**
  ```json
  {
    "error": "An unexpected error occurred during sign up. Please try again later."
  }
  ```

**2. Test Login (Valid Code):**

- Replace `"YOUR_AUTH_CODE_HERE"` with the code you received from the signup step.
- **Command:**
  ```bash
  curl -X POST -H "Content-Type: application/json" -d '{"authCode": "YOUR_AUTH_CODE_HERE"}' http://localhost:3000/api/auth/login
  ```
- **Expected Success Response:**
  ```json
  {
    "success": true,
    "userId": 1
  }
  ```
  (The `userId` will vary)

**3. Test Login (Invalid Code):**

- **Command:**
  ```bash
  curl -X POST -H "Content-Type: application/json" -d '{"authCode": "invalid-fake-code"}' http://localhost:3000/api/auth/login
  ```
- **Expected Error Response:**
  ```json
  {
    "error": "Invalid authentication code. Please check the code and try again."
  }
  ```

## Using the Test Script (`test-auth.sh`)

A shell script `test-auth.sh` is provided in the project root to automate these tests.

1.  **Prerequisites**:

    - Docker and Docker Compose installed.
    - The script must be executable. If not, run: `chmod +x test-auth.sh`
    - `curl` must be installed.
    - `jq` (a command-line JSON processor) is recommended for more reliable parsing of JSON responses. The script has a fallback for basic parsing if `jq` is not found, but it's less robust.

2.  **Running the Script**:
    Navigate to the project root directory in your terminal and execute:

    ```bash
    ./test-auth.sh
    ```

3.  **What the Script Does**:

    - Starts the application services using `docker compose up -d`.
    - Waits for a few seconds for the services to initialize.
    - Sends a POST request to the signup endpoint (`/api/auth/signup`).
    - Extracts the `authCode` from the response.
    - Sends a POST request to the login endpoint (`/api/auth/login`) with the valid `authCode`.
    - Verifies the login was successful.
    - Sends another POST request to the login endpoint with an invalid `authCode`.
    - Verifies this login attempt fails as expected.
    - Stops the Docker services using `docker compose down` (this happens automatically on script exit, success or failure).
    - Outputs informational messages, success messages, or error messages for each step.

4.  **Interpreting Output**:

    - `[INFO]`: General information about the script's progress.
    - `[SUCCESS]`: Indicates a test step passed.
    - `[ERROR]`: Indicates a test step failed or an error occurred. The script will typically exit if an error is encountered (`set -e`).

    If all tests pass, you will see:

    ```
    [SUCCESS] All authentication tests passed!
    [INFO] Cleaning up: Stopping Docker services...
    [INFO] Cleanup complete.
    ```

    If a test fails, an error message will be displayed, and the script will stop. For example:

    ```
    [INFO] Testing signup endpoint: http://localhost:3000/api/auth/signup
    [ERROR] No response from signup endpoint. Is the server running at http://localhost:3000?
    [ERROR] Ensure an API route exists at POST /api/auth/signup that calls the signUp server action.
    [INFO] Cleaning up: Stopping Docker services...
    ```

**Important Note on API Routes:**
The `test-auth.sh` script and manual testing instructions assume that you have Next.js API routes set up at `POST /api/auth/signup` and `POST /api/auth/login`. These API routes should internally call the respective `signUp` and `logIn` server actions from `frontend/src/app/actions/auth.ts`.

If these API routes do not exist, you will need to create them. For example:

**`frontend/src/app/api/auth/signup/route.ts`:**

```typescript
// app/api/auth/signup/route.ts
import { signUp } from "@/app/actions/auth";
import { NextResponse } from "next/server";

export async function POST() {
  const result = await signUp();
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ authCode: result.authCode });
}
```

**`frontend/src/app/api/auth/login/route.ts`:**

```typescript
// app/api/auth/login/route.ts
import { logIn } from "@/app/actions/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const authCode = body.authCode;

    if (!authCode) {
      return NextResponse.json(
        { error: "authCode is required" },
        { status: 400 }
      );
    }

    const result = await logIn(authCode);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 }); // 401 for unauthorized
    }
    return NextResponse.json({
      success: result.success,
      userId: result.userId,
    });
  } catch (error) {
    // Handle cases where request.json() fails (e.g., invalid JSON)
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
```

Remember to adjust status codes and error handling as per your application's requirements.
