#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Configuration ---
APP_URL="http://localhost:3000"
SIGNUP_ENDPOINT="${APP_URL}/api/auth/signup"
LOGIN_ENDPOINT="${APP_URL}/api/auth/login"
WAIT_TIME=15 # Seconds to wait for services to start

# --- Helper Functions ---
log_info() {
  echo "[INFO] $1"
}

log_success() {
  echo "[SUCCESS] $1"
}

log_error() {
  echo "[ERROR] $1" >&2
}

cleanup() {
  log_info "Cleaning up: Stopping Docker services..."
  docker compose down
  log_info "Cleanup complete."
}

# Trap EXIT signal to ensure cleanup runs
trap cleanup EXIT

# --- Main Script ---
log_info "Starting authentication test script..."

# 1. Start the application
log_info "Starting application with 'docker compose up -d'..."
docker compose up -d
log_info "Waiting ${WAIT_TIME} seconds for services to be ready..."
sleep ${WAIT_TIME}

# Verify services are up (optional, basic check)
if ! docker compose ps | grep -q "Up"; then
  log_error "Some services did not start correctly. Check 'docker compose logs'."
  exit 1
fi
log_info "Services appear to be running."

# 2. Test Signup Endpoint
log_info "Testing signup endpoint: ${SIGNUP_ENDPOINT}"
SIGNUP_RESPONSE=$(curl -s -X POST "${SIGNUP_ENDPOINT}")

if [ -z "$SIGNUP_RESPONSE" ]; then
  log_error "No response from signup endpoint. Is the server running at ${APP_URL}?"
  log_error "Ensure an API route exists at POST ${SIGNUP_ENDPOINT} that calls the signUp server action."
  exit 1
fi

log_info "Signup response: ${SIGNUP_RESPONSE}"

# Attempt to extract authCode using jq. Fallback if jq is not installed.
AUTH_CODE=""
if command -v jq &> /dev/null; then
  AUTH_CODE=$(echo "${SIGNUP_RESPONSE}" | jq -r '.authCode // empty')
  SIGNUP_ERROR=$(echo "${SIGNUP_RESPONSE}" | jq -r '.error // empty')
else
  log_info "jq not found. Attempting basic parsing (less reliable)."
  # Basic parsing: assumes format {"authCode":"..."} or {"error":"..."}
  if [[ $SIGNUP_RESPONSE == *"authCode"* ]]; then
    AUTH_CODE=$(echo "$SIGNUP_RESPONSE" | sed -n 's/.*"authCode":"\([^"]*\)".*/\1/p')
  elif [[ $SIGNUP_RESPONSE == *"error"* ]]; then
    SIGNUP_ERROR=$(echo "$SIGNUP_RESPONSE" | sed -n 's/.*"error":"\([^"]*\)".*/\1/p')
  fi
fi


if [ -n "$SIGNUP_ERROR" ]; then
  log_error "Signup failed: ${SIGNUP_ERROR}"
  exit 1
fi

if [ -z "$AUTH_CODE" ] || [ "$AUTH_CODE" == "null" ]; then
  log_error "Failed to retrieve authCode from signup response."
  log_error "Response was: ${SIGNUP_RESPONSE}"
  log_error "Ensure the signup endpoint returns JSON with an 'authCode' field on success."
  exit 1
fi
log_success "Signup successful. Auth Code: ${AUTH_CODE}"

# 3. Test Login Endpoint (Valid Auth Code)
log_info "Testing login endpoint with valid auth code: ${LOGIN_ENDPOINT}"
LOGIN_PAYLOAD="{\"authCode\": \"${AUTH_CODE}\"}"
VALID_LOGIN_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d "${LOGIN_PAYLOAD}" "${LOGIN_ENDPOINT}")

log_info "Valid login response: ${VALID_LOGIN_RESPONSE}"

VALID_LOGIN_SUCCESS=""
VALID_LOGIN_ERROR=""
if command -v jq &> /dev/null; then
  VALID_LOGIN_SUCCESS=$(echo "${VALID_LOGIN_RESPONSE}" | jq -r '.success // empty')
  VALID_LOGIN_ERROR=$(echo "${VALID_LOGIN_RESPONSE}" | jq -r '.error // empty')
else
  if [[ $VALID_LOGIN_RESPONSE == *"success"* ]]; then
     VALID_LOGIN_SUCCESS=$(echo "$VALID_LOGIN_RESPONSE" | sed -n 's/.*"success":\([^,}]*\).*/\1/p' | tr -d ' ')
  elif [[ $VALID_LOGIN_RESPONSE == *"error"* ]]; then
     VALID_LOGIN_ERROR=$(echo "$VALID_LOGIN_RESPONSE" | sed -n 's/.*"error":"\([^"]*\)".*/\1/p')
  fi
fi

if [ "$VALID_LOGIN_SUCCESS" != "true" ]; then
  log_error "Login with valid auth code failed."
  if [ -n "$VALID_LOGIN_ERROR" ]; then
    log_error "Error: ${VALID_LOGIN_ERROR}"
  fi
  log_error "Response was: ${VALID_LOGIN_RESPONSE}"
  log_error "Ensure the login endpoint returns JSON with a 'success: true' field on successful login."
  exit 1
fi
log_success "Login with valid auth code successful."

# 4. Test Login Endpoint (Invalid Auth Code)
INVALID_AUTH_CODE="invalid-test-code-12345"
log_info "Testing login endpoint with invalid auth code: ${INVALID_AUTH_CODE}"
INVALID_LOGIN_PAYLOAD="{\"authCode\": \"${INVALID_AUTH_CODE}\"}"
INVALID_LOGIN_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d "${INVALID_LOGIN_PAYLOAD}" "${LOGIN_ENDPOINT}")

log_info "Invalid login response: ${INVALID_LOGIN_RESPONSE}"

INVALID_LOGIN_SUCCESS=""
INVALID_LOGIN_ERROR=""

if command -v jq &> /dev/null; then
  INVALID_LOGIN_SUCCESS=$(echo "${INVALID_LOGIN_RESPONSE}" | jq -r '.success // empty')
  INVALID_LOGIN_ERROR=$(echo "${INVALID_LOGIN_RESPONSE}" | jq -r '.error // empty')
else
  if [[ $INVALID_LOGIN_RESPONSE == *"success"* ]]; then
     INVALID_LOGIN_SUCCESS=$(echo "$INVALID_LOGIN_RESPONSE" | sed -n 's/.*"success":\([^,}]*\).*/\1/p' | tr -d ' ')
  elif [[ $INVALID_LOGIN_RESPONSE == *"error"* ]]; then
     INVALID_LOGIN_ERROR=$(echo "$INVALID_LOGIN_RESPONSE" | sed -n 's/.*"error":"\([^"]*\)".*/\1/p')
  fi
fi


if [ "$INVALID_LOGIN_SUCCESS" == "true" ] || [ -z "$INVALID_LOGIN_ERROR" ]; then
  log_error "Login with invalid auth code unexpectedly succeeded or did not return an error."
  log_error "Response was: ${INVALID_LOGIN_RESPONSE}"
  log_error "Ensure the login endpoint returns JSON with an 'error' field when an invalid auth code is provided."
  exit 1
fi
log_success "Login with invalid auth code correctly failed with error: ${INVALID_LOGIN_ERROR}"

log_success "All authentication tests passed!"
# Cleanup will be handled by the trap

exit 0