#!/bin/bash

# Test script for orchestrator cron job with HMAC signing
# Usage: ./scripts/test-orchestrator.sh [environment]
# Example: ./scripts/test-orchestrator.sh local
#          ./scripts/test-orchestrator.sh production

set -e

# Ensure PATH includes common tool locations
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:/opt/homebrew/bin:$PATH"

# Define command aliases with explicit paths
CURL_CMD="/usr/bin/curl"
DATE_CMD="/bin/date"
GREP_CMD="/usr/bin/grep"
TAIL_CMD="/usr/bin/tail"
SED_CMD="/usr/bin/sed"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-local}

if [ "$ENVIRONMENT" = "local" ]; then
    BASE_URL="http://localhost:3000"
    echo -e "${BLUE}Testing LOCAL environment${NC}"
elif [ "$ENVIRONMENT" = "production" ]; then
    BASE_URL="https://cloudhalo.app"
    echo -e "${BLUE}Testing PRODUCTION environment${NC}"
else
    echo -e "${RED}Invalid environment. Use 'local' or 'production'${NC}"
    exit 1
fi

# Load environment variables
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
else
    echo -e "${YELLOW}Warning: .env.local not found${NC}"
fi

# Check if CRON_SECRET is set
if [ -z "$CRON_SECRET" ]; then
    echo -e "${RED}Error: CRON_SECRET environment variable not set${NC}"
    exit 1
fi

# Function to generate HMAC-SHA256 signature
# Arguments: METHOD PATH TIMESTAMP BODY SECRET
generate_hmac_signature() {
    local METHOD="$1"
    local PATH="$2"
    local TIMESTAMP="$3"
    local BODY="$4"
    local SECRET="$5"

    # Construct message: METHOD:PATH:TIMESTAMP:BODY
    local MESSAGE="${METHOD}:${PATH}:${TIMESTAMP}:${BODY}"

    # Generate HMAC-SHA256 signature (hex-encoded)
    # Use explicit paths to ensure tools are found
    if command -v openssl >/dev/null 2>&1; then
        OPENSSL_CMD="openssl"
    elif [ -f "/usr/bin/openssl" ]; then
        OPENSSL_CMD="/usr/bin/openssl"
    elif [ -f "/opt/homebrew/bin/openssl" ]; then
        OPENSSL_CMD="/opt/homebrew/bin/openssl"
    else
        echo "Error: openssl not found" >&2
        return 1
    fi

    echo -n "$MESSAGE" | $OPENSSL_CMD dgst -sha256 -hmac "$SECRET" 2>/dev/null | $SED_CMD 's/^.* //'
}

echo ""
echo -e "${BLUE}=== Testing Cron Orchestrator ===${NC}"
echo ""

# Test 1: Call the orchestrator endpoint with HMAC signature
echo -e "${YELLOW}[1/5] Calling orchestrator cron endpoint with HMAC signature...${NC}"

# Generate timestamp (ISO 8601 format)
TIMESTAMP=$($DATE_CMD -u +"%Y-%m-%dT%H:%M:%SZ")
METHOD="GET"
PATH="/api/cron/orchestrator"
BODY=""  # No body for GET request

# Generate HMAC signature
SIGNATURE=$(generate_hmac_signature "$METHOD" "$PATH" "$TIMESTAMP" "$BODY" "$CRON_SECRET")

echo -e "${BLUE}  Timestamp: ${TIMESTAMP}${NC}"
echo -e "${BLUE}  Signature: ${SIGNATURE:0:16}...${NC}"

RESPONSE=$($CURL_CMD -s -w "\n%{http_code}" -X GET \
    "${BASE_URL}/api/cron/orchestrator" \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    -H "X-Cron-Timestamp: ${TIMESTAMP}" \
    -H "X-Cron-Signature: ${SIGNATURE}" \
    -H "Content-Type: application/json")

HTTP_CODE=$(echo "$RESPONSE" | $TAIL_CMD -n 1)
BODY=$(echo "$RESPONSE" | $SED_CMD '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓ Orchestrator endpoint responded successfully (HTTP 200)${NC}"
    echo ""
    echo -e "${BLUE}Response:${NC}"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
    echo -e "${RED}✗ Orchestrator endpoint failed (HTTP $HTTP_CODE)${NC}"
    echo "$BODY"
    exit 1
fi

echo ""
echo -e "${YELLOW}[2/5] Analyzing orchestrator execution results...${NC}"

# Parse the response to check metrics
TASKS_EVALUATED=$(echo "$BODY" | jq -r '.tasksEvaluated' 2>/dev/null || echo "N/A")
TASKS_EXECUTED=$(echo "$BODY" | jq -r '.tasksExecuted' 2>/dev/null || echo "N/A")
TASKS_SUCCESSFUL=$(echo "$BODY" | jq -r '.tasksSuccessful' 2>/dev/null || echo "N/A")
TASKS_FAILED=$(echo "$BODY" | jq -r '.tasksFailed' 2>/dev/null || echo "N/A")
DURATION=$(echo "$BODY" | jq -r '.duration' 2>/dev/null || echo "N/A")

echo -e "${BLUE}  Tasks Evaluated: ${GREEN}${TASKS_EVALUATED}${NC}"
echo -e "${BLUE}  Tasks Executed: ${GREEN}${TASKS_EXECUTED}${NC}"
echo -e "${BLUE}  Tasks Successful: ${GREEN}${TASKS_SUCCESSFUL}${NC}"
echo -e "${BLUE}  Tasks Failed: ${GREEN}${TASKS_FAILED}${NC}"
echo -e "${BLUE}  Total Duration: ${GREEN}${DURATION}ms${NC}"

# Check if any tasks were executed and show their details
if [ "$TASKS_EXECUTED" != "0" ] && [ "$TASKS_EXECUTED" != "N/A" ]; then
    echo ""
    echo -e "${BLUE}  Executed Tasks:${NC}"
    echo "$BODY" | jq -r '.results[] | "    - \(.taskName): \(if .success then "✓ Success" else "✗ Failed" end) (\(.duration)ms)"' 2>/dev/null || echo "    (details not available)"
fi

echo ""
echo -e "${YELLOW}[3/5] Testing wrapper endpoint...${NC}"

# Test the wrapper endpoint (this simulates what Vercel Cron calls)
echo -e "${BLUE}  Calling /api/cron-wrapper/orchestrator...${NC}"

WRAPPER_RESPONSE=$($CURL_CMD -s -w "\n%{http_code}" -X GET \
    "${BASE_URL}/api/cron-wrapper/orchestrator")

WRAPPER_HTTP_CODE=$(echo "$WRAPPER_RESPONSE" | $TAIL_CMD -n 1)

if [ "$WRAPPER_HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}  ✓ Wrapper endpoint is accessible${NC}"
else
    echo -e "${YELLOW}  ⚠ Wrapper endpoint returned HTTP ${WRAPPER_HTTP_CODE}${NC}"
fi

echo ""
echo -e "${YELLOW}[4/5] Testing HMAC signature validation...${NC}"

# Test with expired timestamp (should fail)
EXPIRED_TIMESTAMP="2020-01-01T00:00:00Z"
EXPIRED_SIGNATURE=$(generate_hmac_signature "GET" "/api/cron/orchestrator" "$EXPIRED_TIMESTAMP" "" "$CRON_SECRET")

HTTP_CODE=$($CURL_CMD -s -o /dev/null -w "%{http_code}" -X GET \
    "${BASE_URL}/api/cron/orchestrator" \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    -H "X-Cron-Timestamp: ${EXPIRED_TIMESTAMP}" \
    -H "X-Cron-Signature: ${EXPIRED_SIGNATURE}")

if [ "$HTTP_CODE" -eq 401 ]; then
    echo -e "${GREEN}✓ Expired timestamp properly rejected (HTTP 401)${NC}"
else
    echo -e "${RED}✗ Security issue: Expired timestamp accepted (HTTP ${HTTP_CODE})${NC}"
fi

# Test with invalid signature (should fail)
INVALID_SIGNATURE="0000000000000000000000000000000000000000000000000000000000000000"
CURRENT_TIMESTAMP=$($DATE_CMD -u +"%Y-%m-%dT%H:%M:%SZ")

HTTP_CODE=$($CURL_CMD -s -o /dev/null -w "%{http_code}" -X GET \
    "${BASE_URL}/api/cron/orchestrator" \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    -H "X-Cron-Timestamp: ${CURRENT_TIMESTAMP}" \
    -H "X-Cron-Signature: ${INVALID_SIGNATURE}")

if [ "$HTTP_CODE" -eq 401 ]; then
    echo -e "${GREEN}✓ Invalid signature properly rejected (HTTP 401)${NC}"
else
    echo -e "${RED}✗ Security issue: Invalid signature accepted (HTTP ${HTTP_CODE})${NC}"
fi

echo ""
echo -e "${YELLOW}[5/5] Testing unauthorized access...${NC}"

# Test without auth header (should fail)
HTTP_CODE=$($CURL_CMD -s -o /dev/null -w "%{http_code}" -X GET \
    "${BASE_URL}/api/cron/orchestrator")

if [ "$HTTP_CODE" -eq 401 ]; then
    echo -e "${GREEN}✓ Unauthorized access properly blocked (HTTP 401)${NC}"
else
    echo -e "${RED}✗ Security issue: Endpoint accessible without auth (HTTP ${HTTP_CODE})${NC}"
fi

# Test with wrong secret
WRONG_TIMESTAMP=$($DATE_CMD -u +"%Y-%m-%dT%H:%M:%SZ")
WRONG_SIGNATURE=$(generate_hmac_signature "GET" "/api/cron/orchestrator" "$WRONG_TIMESTAMP" "" "wrong_secret")

HTTP_CODE=$($CURL_CMD -s -o /dev/null -w "%{http_code}" -X GET \
    "${BASE_URL}/api/cron/orchestrator" \
    -H "Authorization: Bearer wrong_secret" \
    -H "X-Cron-Timestamp: ${WRONG_TIMESTAMP}" \
    -H "X-Cron-Signature: ${WRONG_SIGNATURE}")

if [ "$HTTP_CODE" -eq 401 ]; then
    echo -e "${GREEN}✓ Invalid secret properly rejected (HTTP 401)${NC}"
else
    echo -e "${RED}✗ Security issue: Invalid secret accepted (HTTP ${HTTP_CODE})${NC}"
fi

echo ""
echo -e "${GREEN}=== All tests completed ===${NC}"
echo ""

# Summary
if [ "$TASKS_FAILED" != "0" ] && [ "$TASKS_FAILED" != "N/A" ]; then
    echo -e "${RED}⚠ Warning: ${TASKS_FAILED} task(s) failed. Check server logs for details.${NC}"
elif [ "$TASKS_EXECUTED" != "0" ] && [ "$TASKS_EXECUTED" != "N/A" ]; then
    echo -e "${GREEN}✓ ${TASKS_EXECUTED} task(s) executed successfully.${NC}"
else
    echo -e "${BLUE}ℹ No tasks were scheduled to run at this time.${NC}"
    echo -e "${BLUE}  This is expected - tasks run based on their cron schedules:${NC}"
    echo -e "${BLUE}    - poll-costs: Daily at 2 AM UTC${NC}"
    echo -e "${BLUE}    - poll-resources: Daily at 3 AM UTC${NC}"
    echo -e "${BLUE}    - evaluate-alerts: Daily at 4 AM UTC${NC}"
    echo -e "${BLUE}    - send-reports: Weekly on Mondays at 8 AM UTC${NC}"
fi

echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Check server logs for detailed orchestrator output"
echo "  2. To test individual endpoints directly: ./scripts/test-alert-cron.sh local"
echo "  3. Task schedules are configured in src/lib/cron/task-scheduler.ts"
echo "  4. To manually trigger a specific task, call its endpoint directly with HMAC auth"
echo ""
