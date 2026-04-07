#!/bin/bash
# API test suite for etasks
# Usage: ./test-api.sh [base_url]

BASE="${1:-http://localhost:3000}"
AUTH="x-telegram-init-data: dev"
PASS=0
FAIL=0
ERRORS=""

test_endpoint() {
  local method="$1" url="$2" body="$3" expect_code="$4" desc="$5" check="$6"

  local args=(-s -w "\n%{http_code}" -H "$AUTH")
  if [ "$method" != "GET" ]; then
    args+=(-X "$method" -H "Content-Type: application/json")
    [ -n "$body" ] && args+=(-d "$body")
  fi

  local response
  response=$(curl "${args[@]}" "$BASE$url")
  local code=$(echo "$response" | tail -1)
  local body_out=$(echo "$response" | sed '$d')

  if [ "$code" = "$expect_code" ]; then
    if [ -n "$check" ]; then
      if echo "$body_out" | grep -q "$check"; then
        echo "  ✓ $desc (HTTP $code)"
        PASS=$((PASS+1))
      else
        echo "  ✗ $desc (HTTP $code but missing: $check)"
        echo "    Response: $(echo "$body_out" | head -c 200)"
        FAIL=$((FAIL+1))
        ERRORS="$ERRORS\n  - $desc: expected '$check' in response"
      fi
    else
      echo "  ✓ $desc (HTTP $code)"
      PASS=$((PASS+1))
    fi
  else
    echo "  ✗ $desc (expected $expect_code, got $code)"
    echo "    Response: $(echo "$body_out" | head -c 300)"
    FAIL=$((FAIL+1))
    ERRORS="$ERRORS\n  - $desc: expected HTTP $expect_code, got $code"
  fi

  # Return body for chaining
  echo "$body_out" > /tmp/etasks_last_response.json
}

echo ""
echo "═══════════════════════════════════════"
echo "  eTask API Test Suite"
echo "  Base: $BASE"
echo "═══════════════════════════════════════"
echo ""

# ─── Auth ───
echo "── Auth ──"
test_endpoint GET "/api/home" "" "200" "GET /api/home (dev auth)" '"firstName":"E"'
test_endpoint GET "/api/home" "" "200" "Home returns language" '"language"'
test_endpoint GET "/api/home" "" "200" "Home returns boards with language" '"boards"'

# ─── User ───
echo ""
echo "── User ──"
test_endpoint GET "/api/user" "" "200" "GET /api/user" '"username":"emadex"'
test_endpoint PATCH "/api/user" '{"language":"ru"}' "200" "PATCH /api/user language=ru" '"language":"ru"'
test_endpoint PATCH "/api/user" '{"language":"en"}' "200" "PATCH /api/user language=en (restore)" '"language":"en"'

# ─── Task CRUD ───
echo ""
echo "── Task Creation ──"

# Create personal task
test_endpoint POST "/api/tasks" '{"title":"Test task from suite","priority":"high"}' "201" "Create personal task" '"title":"Test task from suite"'
PERSONAL_TASK_ID=$(cat /tmp/etasks_last_response.json | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
echo "    Created task: $PERSONAL_TASK_ID"

# Create board task (use chatId from existing board)
test_endpoint POST "/api/tasks" '{"title":"Board test task","chatId":"-4929114614","priority":"low","dateDue":"2026-04-15T12:00:00Z"}' "201" "Create board task with due date" '"title":"Board test task"'
BOARD_TASK_ID=$(cat /tmp/etasks_last_response.json | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
echo "    Created board task: $BOARD_TASK_ID"

# ─── Task Updates ───
echo ""
echo "── Task Updates ──"

# Get members for assignment
MEMBERS_JSON=$(curl -s -H "$AUTH" "$BASE/api/members?chatId=-4929114614")
MEMBER_ID=$(echo "$MEMBERS_JSON" | python3 -c "import sys,json; members=json.load(sys.stdin); print(next(m['id'] for m in members if m['username']=='emadex'))" 2>/dev/null)
echo "    Member ID (emadex): $MEMBER_ID"

# Assign
if [ -n "$BOARD_TASK_ID" ] && [ -n "$MEMBER_ID" ]; then
  test_endpoint PATCH "/api/tasks/$BOARD_TASK_ID" "{\"assigneeId\":\"$MEMBER_ID\"}" "200" "Assign task to self" "\"assigneeId\":\"$MEMBER_ID\""
else
  echo "  ✗ Assign task — missing task or member ID"
  FAIL=$((FAIL+1))
fi

# Change status
if [ -n "$BOARD_TASK_ID" ]; then
  test_endpoint PATCH "/api/tasks/$BOARD_TASK_ID" '{"status":"in_progress"}' "200" "Change status to in_progress" '"status":"in_progress"'
  test_endpoint PATCH "/api/tasks/$BOARD_TASK_ID" '{"status":"done"}' "200" "Change status to done" '"status":"done"'
  test_endpoint PATCH "/api/tasks/$BOARD_TASK_ID" '{"status":"todo"}' "200" "Change status back to todo" '"status":"todo"'
fi

# Change priority
if [ -n "$BOARD_TASK_ID" ]; then
  test_endpoint PATCH "/api/tasks/$BOARD_TASK_ID" '{"priority":"high"}' "200" "Change priority to high" '"priority":"high"'
fi

# Update title and description
if [ -n "$PERSONAL_TASK_ID" ]; then
  test_endpoint PATCH "/api/tasks/$PERSONAL_TASK_ID" '{"title":"Updated title","description":"A test description"}' "200" "Update title and description" '"title":"Updated title"'
fi

# ─── Due Date & Planned ───
echo ""
echo "── Due Date & Planned ──"

if [ -n "$PERSONAL_TASK_ID" ]; then
  test_endpoint PATCH "/api/tasks/$PERSONAL_TASK_ID" '{"dateDue":"2026-04-20T15:00:00Z"}' "200" "Set due date" '"dateDue"'
  test_endpoint PATCH "/api/tasks/$PERSONAL_TASK_ID" '{"datePlanned":"2026-04-18T10:00:00Z"}' "200" "Set planned date" '"datePlanned"'
  test_endpoint PATCH "/api/tasks/$PERSONAL_TASK_ID" '{"dateDue":null}' "200" "Clear due date" ""
  test_endpoint PATCH "/api/tasks/$PERSONAL_TASK_ID" '{"datePlanned":null}' "200" "Clear planned date" ""
fi

# ─── Reminders ───
echo ""
echo "── Reminders ──"

if [ -n "$BOARD_TASK_ID" ]; then
  # Board task already has dateDue
  test_endpoint PATCH "/api/tasks/$BOARD_TASK_ID" '{"reminders":{"1h":true}}' "200" "Toggle reminder 1h on" ""
  test_endpoint PATCH "/api/tasks/$BOARD_TASK_ID" '{"reminders":{"24h":true}}' "200" "Toggle reminder 24h on" ""
  test_endpoint PATCH "/api/tasks/$BOARD_TASK_ID" '{"reminders":{"1h":false}}' "200" "Toggle reminder 1h off" ""

  # Check reminders exist
  test_endpoint GET "/api/tasks/$BOARD_TASK_ID" "" "200" "Get task with reminders" '"reminders"'
fi

# ─── Cron endpoint ───
echo ""
echo "── Cron ──"
test_endpoint GET "/api/notify/deadline?secret=dev-local" "" "200" "Cron endpoint works" '"ok":true'
test_endpoint GET "/api/notify/deadline?secret=wrong" "" "401" "Cron rejects bad secret" ""

# ─── Comments ───
echo ""
echo "── Comments ──"

if [ -n "$BOARD_TASK_ID" ]; then
  test_endpoint POST "/api/comments" "{\"taskId\":\"$BOARD_TASK_ID\",\"text\":\"Test comment\"}" "201" "Add comment" '"text":"Test comment"'
  test_endpoint GET "/api/comments?taskId=$BOARD_TASK_ID" "" "200" "Get comments" '"Test comment"'
fi

# ─── Move Task ───
echo ""
echo "── Move Task ──"

if [ -n "$BOARD_TASK_ID" ]; then
  # Move to personal inbox
  test_endpoint PATCH "/api/tasks/$BOARD_TASK_ID" '{"boardId":null}' "200" "Move task to personal inbox" '"boardId":null'
  # Move back to board
  BOARD_ID=$(curl -s -H "$AUTH" "$BASE/api/home" | python3 -c "import sys,json; print(json.load(sys.stdin)['boards'][0]['id'])" 2>/dev/null)
  if [ -n "$BOARD_ID" ]; then
    test_endpoint PATCH "/api/tasks/$BOARD_TASK_ID" "{\"boardId\":\"$BOARD_ID\"}" "200" "Move task back to board" "\"boardId\":\"$BOARD_ID\""
  fi
fi

# ─── Board Language ───
echo ""
echo "── Board Language ──"

if [ -n "$BOARD_ID" ]; then
  test_endpoint PATCH "/api/boards" "{\"boardId\":\"$BOARD_ID\",\"language\":\"ru\"}" "200" "Set board language to ru" '"language":"ru"'
  test_endpoint PATCH "/api/boards" "{\"boardId\":\"$BOARD_ID\",\"language\":\"en\"}" "200" "Set board language back to en" '"language":"en"'
fi

# ─── Archive ───
echo ""
echo "── Archive ──"

if [ -n "$PERSONAL_TASK_ID" ]; then
  test_endpoint PATCH "/api/tasks/$PERSONAL_TASK_ID" '{"archivedAt":"2026-04-07T12:00:00Z"}' "200" "Archive task" '"archivedAt"'
  test_endpoint PATCH "/api/tasks/$PERSONAL_TASK_ID" '{"archivedAt":null}' "200" "Unarchive task" ""
fi

# ─── Cleanup ───
echo ""
echo "── Cleanup ──"

if [ -n "$PERSONAL_TASK_ID" ]; then
  test_endpoint DELETE "/api/tasks/$PERSONAL_TASK_ID" "" "200" "Delete personal task" ""
fi
if [ -n "$BOARD_TASK_ID" ]; then
  test_endpoint DELETE "/api/tasks/$BOARD_TASK_ID" "" "200" "Delete board task" ""
fi

# ─── Summary ───
echo ""
echo "═══════════════════════════════════════"
echo "  Results: $PASS passed, $FAIL failed"
echo "═══════════════════════════════════════"

if [ $FAIL -gt 0 ]; then
  echo ""
  echo "Failures:"
  echo -e "$ERRORS"
  echo ""
  exit 1
fi

echo ""
rm -f /tmp/etasks_last_response.json
