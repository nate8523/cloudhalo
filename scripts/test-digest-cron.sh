#!/bin/bash

# Test script for digest/reports cron job with HMAC signing
# Usage: ./scripts/test-digest-cron.sh [environment]
# Example: ./scripts/test-digest-cron.sh local
#          ./scripts/test-digest-cron.sh production

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
echo -e "${BLUE}=== Testing Digest & Reports Cron Job ===${NC}"
echo ""

# Test 1: Call the send-reports endpoint with HMAC signature
echo -e "${YELLOW}[1/4] Calling send-reports cron endpoint with HMAC signature...${NC}"

# Generate timestamp (ISO 8601 format)
TIMESTAMP=$($DATE_CMD -u +"%Y-%m-%dT%H:%M:%SZ")
METHOD="POST"
PATH="/api/cron/send-reports"
BODY=""  # No body for this POST request

# Generate HMAC signature
SIGNATURE=$(generate_hmac_signature "$METHOD" "$PATH" "$TIMESTAMP" "$BODY" "$CRON_SECRET")

echo -e "${BLUE}  Timestamp: ${TIMESTAMP}${NC}"
echo -e "${BLUE}  Signature: ${SIGNATURE:0:16}...${NC}"

RESPONSE=$($CURL_CMD -s -w "\n%{http_code}" -X POST \
    "${BASE_URL}/api/cron/send-reports" \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    -H "X-Cron-Timestamp: ${TIMESTAMP}" \
    -H "X-Cron-Signature: ${SIGNATURE}" \
    -H "Content-Type: application/json")

HTTP_CODE=$(echo "$RESPONSE" | $TAIL_CMD -n 1)
RESPONSE_BODY=$(echo "$RESPONSE" | $SED_CMD '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓ Cron endpoint responded successfully (HTTP 200)${NC}"
    echo ""
    echo -e "${BLUE}Response:${NC}"
    echo "$RESPONSE_BODY" | jq '.' 2>/dev/null || echo "$RESPONSE_BODY"
else
    echo -e "${RED}✗ Cron endpoint failed (HTTP $HTTP_CODE)${NC}"
    echo "$RESPONSE_BODY"
    exit 1
fi

echo ""
echo -e "${YELLOW}[2/4] Verifying digest processing metrics...${NC}"

# Parse the response to check metrics
DIGEST_PROCESSED=$(echo "$RESPONSE_BODY" | jq -r '.digestResults.processed' 2>/dev/null || echo "N/A")
DIGEST_SENT=$(echo "$RESPONSE_BODY" | jq -r '.digestResults.sent' 2>/dev/null || echo "N/A")
DIGEST_SKIPPED=$(echo "$RESPONSE_BODY" | jq -r '.digestResults.skipped' 2>/dev/null || echo "N/A")
DIGEST_FAILED=$(echo "$RESPONSE_BODY" | jq -r '.digestResults.failed' 2>/dev/null || echo "N/A")

REPORT_PROCESSED=$(echo "$RESPONSE_BODY" | jq -r '.reportResults.processed' 2>/dev/null || echo "N/A")
REPORT_SENT=$(echo "$RESPONSE_BODY" | jq -r '.reportResults.sent' 2>/dev/null || echo "N/A")
REPORT_SKIPPED=$(echo "$RESPONSE_BODY" | jq -r '.reportResults.skipped' 2>/dev/null || echo "N/A")
REPORT_FAILED=$(echo "$RESPONSE_BODY" | jq -r '.reportResults.failed' 2>/dev/null || echo "N/A")

echo -e "${BLUE}Digest Results:${NC}"
echo -e "  Processed: ${GREEN}${DIGEST_PROCESSED}${NC}"
echo -e "  Sent: ${GREEN}${DIGEST_SENT}${NC}"
echo -e "  Skipped: ${YELLOW}${DIGEST_SKIPPED}${NC}"
echo -e "  Failed: ${RED}${DIGEST_FAILED}${NC}"

echo ""
echo -e "${BLUE}Report Results:${NC}"
echo -e "  Processed: ${GREEN}${REPORT_PROCESSED}${NC}"
echo -e "  Sent: ${GREEN}${REPORT_SENT}${NC}"
echo -e "  Skipped: ${YELLOW}${REPORT_SKIPPED}${NC}"
echo -e "  Failed: ${RED}${REPORT_FAILED}${NC}"

echo ""
echo -e "${YELLOW}[3/4] Testing HMAC signature validation...${NC}"

# Test with expired timestamp (should fail)
EXPIRED_TIMESTAMP="2020-01-01T00:00:00Z"
EXPIRED_SIGNATURE=$(generate_hmac_signature "POST" "/api/cron/send-reports" "$EXPIRED_TIMESTAMP" "" "$CRON_SECRET")

HTTP_CODE=$($CURL_CMD -s -o /dev/null -w "%{http_code}" -X POST \
    "${BASE_URL}/api/cron/send-reports" \
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

HTTP_CODE=$($CURL_CMD -s -o /dev/null -w "%{http_code}" -X POST \
    "${BASE_URL}/api/cron/send-reports" \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    -H "X-Cron-Timestamp: ${CURRENT_TIMESTAMP}" \
    -H "X-Cron-Signature: ${INVALID_SIGNATURE}")

if [ "$HTTP_CODE" -eq 401 ]; then
    echo -e "${GREEN}✓ Invalid signature properly rejected (HTTP 401)${NC}"
else
    echo -e "${RED}✗ Security issue: Invalid signature accepted (HTTP ${HTTP_CODE})${NC}"
fi

echo ""
echo -e "${YELLOW}[4/4] Testing unauthorized access...${NC}"

# Test without auth header (should fail)
HTTP_CODE=$($CURL_CMD -s -o /dev/null -w "%{http_code}" -X POST \
    "${BASE_URL}/api/cron/send-reports")

if [ "$HTTP_CODE" -eq 401 ]; then
    echo -e "${GREEN}✓ Unauthorized access properly blocked (HTTP 401)${NC}"
else
    echo -e "${RED}✗ Security issue: Endpoint accessible without auth (HTTP ${HTTP_CODE})${NC}"
fi

# Test with wrong secret
WRONG_TIMESTAMP=$($DATE_CMD -u +"%Y-%m-%dT%H:%M:%SZ")
WRONG_SIGNATURE=$(generate_hmac_signature "POST" "/api/cron/send-reports" "$WRONG_TIMESTAMP" "" "wrong_secret")

HTTP_CODE=$($CURL_CMD -s -o /dev/null -w "%{http_code}" -X POST \
    "${BASE_URL}/api/cron/send-reports" \
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
if [ "$DIGEST_SENT" != "0" ] && [ "$DIGEST_SENT" != "N/A" ]; then
    echo -e "${YELLOW}⚠ Note: ${DIGEST_SENT} digest(s) were sent. Check your email and alert_digest_queue table.${NC}"
elif [ "$DIGEST_PROCESSED" != "0" ] && [ "$DIGEST_PROCESSED" != "N/A" ]; then
    echo -e "${GREEN}✓ ${DIGEST_PROCESSED} organization(s) processed for digests (none sent).${NC}"
else
    echo -e "${BLUE}ℹ No organizations with pending digest items found.${NC}"
fi

if [ "$REPORT_SENT" != "0" ] && [ "$REPORT_SENT" != "N/A" ]; then
    echo -e "${YELLOW}⚠ Note: ${REPORT_SENT} report(s) were sent. Check your email and scheduled_reports table.${NC}"
elif [ "$REPORT_PROCESSED" != "0" ] && [ "$REPORT_PROCESSED" != "N/A" ]; then
    echo -e "${GREEN}✓ ${REPORT_PROCESSED} report(s) processed (none sent - may not be scheduled for today).${NC}"
else
    echo -e "${BLUE}ℹ No scheduled reports found or reports not due today.${NC}"
fi

echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Check server logs for detailed processing output"
echo "  2. Query alert_digest_queue table to see queued digest items"
echo "  3. Verify email delivery in your inbox"
echo "  4. Monitor Resend dashboard for email delivery status"
echo ""
