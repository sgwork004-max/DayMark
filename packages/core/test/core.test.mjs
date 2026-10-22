import test from "node:test";
import assert from "node:assert/strict";
import {
  parseTasks,
  periodicDefaultContent,
  scheduleTask,
  toggleTask,
  appendDailyReview,
  rolloverOpenTasks,
  setDailyFocus,
  buildExecutionMemory,
  setTaskCompleted,
  taskDisplayContent,
  taskProject,
  updateTaskMetadata,
  isValidDate,
  isValidShortDate,
  isValidTime,
  migrateDailyAgenda,
  insertExternalAgendaTask,
  parseNaturalTaskInput,
  calculateDailyMetrics,
  findCarryoverInsights,
  insertAIResponseUnderNotes,
  layoutCalendarEvents,
} from "../dist/index.js";

test("lays overlapping calendar events into stable non-overlapping columns", () => {
  const event = (id, start, end) => ({
    id,
    title: id,
    startISO: `2026-07-22T${start}:00`,
    endISO: `2026-07-22T${end}:00`,
    calendar: "Work",
    isAllDay: false,
  });
  const layouts = layoutCalendarEvents([
    event("A", "09:00", "10:30"),
    event("B", "09:30", "10:00"),
    event("C", "10:00", "11:00"),
  ]);

  assert.equal(layouts.length, 3);
  assert.deepEqual(layouts.map((item) => item.columnCount), [2, 2, 2]);
  assert.equal(layouts[0]?.widthPct, 50);
  assert.equal(layouts[1]?.leftPct, 50);
  assert.equal(layouts[2]?.leftPct, 50);
});

test("parses native task metadata using short dates", () => {
  const [task] = parseTasks(
    "- [ ] Ship beta >15/07 @due(18/07) @remind(15/07 09:30) #launch @founders",
    "2026-07-12",
  );

  assert.ok(task);
  assert.match(task.content, /^Ship beta/);
  assert.equal(task.scheduledDate, "2026-07-15");
  assert.equal(task.dueDate, "2026-07-18");
  assert.equal(task.reminderDate, "2026-07-15T09:30");
  assert.deepEqual(task.tags, ["launch"]);
  assert.deepEqual(task.mentions, ["founders"]);
});

test("scheduling and completion preserve a valid markdown task", () => {
  const scheduled = scheduleTask("- [ ] Prepare brief", 0, "2026-07-15");
  assert.equal(scheduled, "- [ ] Prepare brief >2026-07-15");
  assert.match(toggleTask(scheduled, 0), /^- \[x\] Prepare brief/);
});

test("daily notes contain the operating template", () => {
  const note = periodicDefaultContent("daily", "2026-07-12");
  assert.match(note, /## Today's Agenda/);
  assert.match(note, /## Today's Agenda\n### P1/);
  assert.match(note, /### P1\n- \[ \]/);
  assert.match(note, /### P2\n- \[ \]/);
  assert.match(note, /### P3\n- \[ \]/);
  assert.match(note, /### Misc\n- \[ \]/);
  assert.doesNotMatch(note, /## AI Pipeline/);
  assert.match(note, /### Misc\n- \[ \] \n\n## Notes/);
});

test("migrates focus and agenda into priority tasks without losing content", () => {
  const migrated = migrateDailyAgenda("# Today\n\n## Day's Focus\n- Ship proposal\n\n## Agenda\n- [ ] Call client\n\n## Notes\nKeep this\n");
  assert.match(migrated, /## Today's Agenda/);
  assert.match(migrated, /### P1\n- \[ \] Ship proposal/);
  assert.match(migrated, /### P2\n- \[ \] Call client/);
  assert.match(migrated, /### P3\n- \[ \]/);
  assert.match(migrated, /Keep this/);
  assert.doesNotMatch(migrated, /Day's Focus/);
});

test("cleans legacy bare-dash placeholders from the priority agenda", () => {
  const cleaned = migrateDailyAgenda("# Today\n\n## Today's Agenda\n\nP1\n- [ ] -\n\nP2\n- [ ] \n");
  assert.doesNotMatch(cleaned, /- \[ \] -/);
  assert.match(cleaned, /## Today's Agenda\n### P1/);
  assert.match(cleaned, /### P2/);
  assert.equal(parseTasks(cleaned, "2026-07-20").length, 0);
});

test("routes external tasks by priority and lets the drop lane override it", () => {
  const template = periodicDefaultContent("daily", "2026-07-20");
  const automatic = insertExternalAgendaTask(template, "Critical follow-up", 4);
  assert.equal(automatic.lane, "P1");
  assert.match(automatic.content, /### P1\n- \[ \] Critical follow-up/);

  const p3Line = automatic.content.split("\n").findIndex((line) => line === "### P3") + 1;
  const overridden = insertExternalAgendaTask(automatic.content, "Draft collateral", 4, p3Line);
  assert.equal(overridden.lane, "P3");
  assert.match(overridden.content, /### P3\n- \[ \] Draft collateral/);

  const duplicate = insertExternalAgendaTask(overridden.content, "Draft collateral", 4);
  assert.equal(duplicate.inserted, false);
});

test("plans three outcomes without replacing the rest of the note", () => {
  const original = "# Today\n\n## Day's Focus\n\n## Agenda\n- [ ] Ship beta\n\n## Notes\nKeep this\n";
  const planned = setDailyFocus(original, ["Ship beta", "Call users", "Review launch", "Ignored"]);
  assert.match(planned, /## Day's Focus\n\n- Ship beta\n- Call users\n- Review launch/);
  assert.match(planned, /Keep this/);
});

test("rolls unfinished work forward and marks the source", () => {
  const source = "# Today\n\n## Agenda\n- [ ] Ship beta @due(18/07)\n- [x] Done\n\n## Notes\n";
  const target = periodicDefaultContent("daily", "2026-07-13");
  const result = rolloverOpenTasks(source, target, "2026-07-12", "2026-07-13");
  assert.equal(result.count, 1);
  assert.match(result.sourceContent, /- \[>\] Ship beta @due\(18\/07\) >2026-07-13/);
  assert.match(result.targetContent, /### Misc\n\s*- \[ \] Ship beta @due\(18\/07\)/);
  assert.doesNotMatch(result.targetContent, /- \[ \] Done/);

  const repeated = rolloverOpenTasks(result.sourceContent, result.targetContent, "2026-07-12", "2026-07-13");
  assert.equal(repeated.count, 0);
});

test("parses natural scheduling without requiring a year", () => {
  const parsed = parseNaturalTaskInput("Send proposal Friday 4pm remind me at 3:30pm", "2026-07-20");
  assert.equal(parsed.title, "Send proposal");
  assert.equal(parsed.priority, "P1");
  assert.equal(parsed.scheduledDate, "2026-07-24");
  assert.equal(parsed.scheduledTime, "16:00");
  assert.match(parsed.markdown, />24\/07/);
  assert.match(parsed.markdown, /@remind\(24\/07 15:30\)/);
});

test("parses compact Todoist-style task shorthand", () => {
  const parsed = parseNaturalTaskInput("DO XYZ mon p1 10.30am", "2026-08-18");
  assert.equal(parsed.title, "DO XYZ");
  assert.equal(parsed.priority, "P1");
  assert.equal(parsed.scheduledDate, "2026-08-24");
  assert.equal(parsed.scheduledTime, "10:30");
  assert.match(parsed.markdown, />24\/08/);
  assert.match(parsed.markdown, /@remind\(24\/08 10:30\)/);
});

test("routes compact priority shorthand into the requested agenda lane", () => {
  assert.equal(parseNaturalTaskInput("Draft launch page tomorrow p2", "2026-08-18").priority, "P2");
  assert.equal(parseNaturalTaskInput("Tidy backlog today p4", "2026-08-18").priority, "Misc");
});

test("calculates daily progress and detects repeatedly carried work", () => {
  const content = "## Today's Agenda\n### P1\n- [x] Ship @done(20/07)\n- [ ] Sell\n### Misc\n- [x] Email\n";
  const metrics = calculateDailyMetrics(content, "2026-07-20");
  assert.equal(metrics.total, 3);
  assert.equal(metrics.completed, 2);
  assert.equal(metrics.p1Completed, 1);
  assert.ok(metrics.score > 50);

  const insights = findCarryoverInsights("### Misc\n- [ ] Sell\n", [
    { date: "2026-07-18", content: "- [>] Sell >19/07" },
    { date: "2026-07-19", content: "- [>] Sell >20/07" },
  ], "2026-07-20");
  assert.deepEqual(insights, [{ content: "Sell", occurrences: 2 }]);
});

test("inserts an AI response directly under Notes with prompt context", () => {
  const result = insertAIResponseUnderNotes(
    "# Today\n\n## Notes\n\nExisting note\n",
    "- First answer\n- Second answer",
    "What should I prioritize today?",
  );
  assert.match(result, /## Notes\n\n### Gemini: What should I prioritize today\?/);
  assert.match(result, /- First answer\n- Second answer/);
  assert.match(result, /Existing note/);
});

test("adds a compact daily review", () => {
  const reviewed = appendDailyReview("# Today\n\n## Notes\n", {
    win: "Shipped the beta",
    learned: "Onboarding needs work",
    tomorrow: "Fix activation",
    completedAt: "18:30",
  });
  assert.match(reviewed, /## Daily Review/);
  assert.match(reviewed, /\*\*Win:\*\* Shipped the beta/);
});

test("builds execution memory from prior daily notes", () => {
  const brief = buildExecutionMemory([
    {
      date: "2026-07-11",
      content: "## Agenda\n- [>] Fix activation >2026-07-12\n\n## Daily Review\n- **Win:** Shipped beta\n- **Learned:** Users need examples\n- **Tomorrow:** Fix activation\n",
    },
    {
      date: "2026-07-12",
      content: "## Agenda\n- [ ] Fix activation\n\n## Daily Review\n- **Win:** Interviewed users\n- **Learned:** Setup is unclear\n- **Tomorrow:** Rewrite onboarding\n",
    },
  ], "2026-07-13");

  assert.deepEqual(brief.handoff, { text: "Rewrite onboarding", date: "2026-07-12" });
  assert.equal(brief.wins[0]?.text, "Interviewed users");
  assert.equal(brief.learnings[0]?.text, "Setup is unclear");
  assert.equal(brief.recurringLoops[0]?.text, "Fix activation");
  assert.equal(brief.recurringLoops[0]?.occurrences, 2);
});

test("edits native task metadata without breaking readable markdown", () => {
  const updated = updateTaskMetadata("- [ ] Prepare proposal #project/Old >12/07", 0, {
    scheduled: "2026-07-15",
    deadline: "18/07",
    reminderDate: "15/07",
    reminderTime: "09:30",
    project: "Acme",
  });
  assert.equal(
    updated,
    "- [ ] Prepare proposal >15/07 @due(18/07) @remind(15/07 09:30) #project/Acme",
  );

  const [task] = parseTasks(updated, "2026-07-13");
  assert.ok(task);
  assert.equal(taskProject(task), "Acme");
  assert.equal(taskDisplayContent(task), "Prepare proposal");
});

test("completes and reopens native tasks with a completion date", () => {
  const completed = setTaskCompleted("- [ ] Ship Manager", 0, true, "13/07");
  assert.equal(completed, "- [x] Ship Manager @done(13/07)");
  assert.equal(setTaskCompleted(completed, 0, false, "13/07"), "- [ ] Ship Manager");
});

test("rejects impossible task dates and reminder times", () => {
  assert.equal(isValidDate("2026-02-29"), false);
  assert.equal(isValidDate("2028-02-29"), true);
  assert.equal(isValidShortDate("31/04", 2026), false);
  assert.equal(isValidShortDate("30/04", 2026), true);
  assert.equal(isValidTime("23:59"), true);
  assert.equal(isValidTime("24:00"), false);
  const [task] = parseTasks("- [ ] Impossible >31/02 @due(00/13)", "2026-07-13");
  assert.ok(task);
  assert.equal(task.scheduledDate, undefined);
  assert.equal(task.dueDate, undefined);
});
