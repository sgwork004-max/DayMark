use serde::{Deserialize, Serialize};
use std::process::Command;


#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TodoistDue {
    pub date: Option<String>,
    pub string: Option<String>,
    pub datetime: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TodoistTask {
    pub id: String,
    pub content: String,
    pub description: Option<String>,
    pub priority: Option<i64>,
    pub labels: Option<Vec<String>>,
    pub due: Option<TodoistDue>,
    pub url: Option<String>,
    pub project_id: Option<String>,
    pub section_id: Option<String>,
    pub parent_id: Option<String>,
    pub child_order: Option<i64>,
    pub day_order: Option<i64>,
    #[serde(default)]
    pub subtasks: Vec<TodoistTask>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TodoistProject {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TodoistSection {
    pub id: String,
    pub name: String,
    pub project_id: Option<String>,
    pub order: Option<i64>,
    pub child_order: Option<i64>,
    pub section_order: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TodoistSectionGroup {
    pub id: String,
    pub name: String,
    pub order: i64,
    pub tasks: Vec<TodoistTask>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TodoistProjectBoard {
    pub label: String,
    pub project_id: Option<String>,
    pub sections: Vec<TodoistSectionGroup>,
}

#[derive(Debug, Deserialize)]
struct TodoistFilterResponse {
    #[serde(default)]
    results: Vec<TodoistTask>,
}

fn parse_list<T: for<'de> Deserialize<'de>>(body: &str) -> Result<Vec<T>, String> {
    let value: serde_json::Value = serde_json::from_str(body)
        .map_err(|_| "Todoist returned an unexpected response.".to_string())?;

    if value.is_array() {
        return serde_json::from_value(value)
            .map_err(|_| "Todoist returned an unexpected response.".to_string());
    }

    if let Some(results) = value.get("results") {
        return serde_json::from_value(results.clone())
            .map_err(|_| "Todoist returned an unexpected response.".to_string());
    }

    Ok(Vec::new())
}

fn run_curl(args: &[&str]) -> Result<String, String> {
    let output = Command::new("/usr/bin/curl")
        .args(args)
        .output()
        .map_err(|e| format!("Could not run curl: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !output.status.success() {
        return Err(if stderr.trim().is_empty() {
            "Todoist request failed.".to_string()
        } else {
            stderr.trim().to_string()
        });
    }

    Ok(stdout)
}

fn json_escape(s: &str) -> String {
    s.chars()
        .flat_map(|c| match c {
            '"' => "\\\"".chars().collect::<Vec<_>>(),
            '\\' => "\\\\".chars().collect::<Vec<_>>(),
            '\n' => "\\n".chars().collect::<Vec<_>>(),
            '\r' => "\\r".chars().collect::<Vec<_>>(),
            '\t' => "\\t".chars().collect::<Vec<_>>(),
            _ => vec![c],
        })
        .collect()
}

#[tauri::command]
pub async fn get_todoist_today_tasks(token: String) -> Result<Vec<TodoistTask>, String> {
    let token = token.trim().to_string();
    if token.is_empty() {
        return Ok(Vec::new());
    }

    tauri::async_runtime::spawn_blocking(move || {
        let auth = format!("Authorization: Bearer {token}");
        let body = run_curl(&[
            "--silent",
            "--show-error",
            "--fail-with-body",
            "--connect-timeout",
            "5",
            "--max-time",
            "10",
            "-H",
            &auth,
            "-H",
            "Accept: application/json",
            "https://api.todoist.com/api/v1/tasks/filter?query=today%20%7C%20overdue&limit=50",
        ])?;

        let parsed: TodoistFilterResponse = serde_json::from_str(&body)
            .map_err(|_| "Todoist returned an unexpected response.".to_string())?;
        Ok(parsed.results)
    })
    .await
    .map_err(|e| format!("Todoist task failed: {e}"))?
}

#[tauri::command]
pub async fn get_todoist_project_boards(token: String) -> Result<Vec<TodoistProjectBoard>, String> {
    let token = token.trim().to_string();
    if token.is_empty() {
        return Ok(Vec::new());
    }

    tauri::async_runtime::spawn_blocking(move || {
        let auth = format!("Authorization: Bearer {token}");
        let projects_body = run_curl(&[
            "--silent",
            "--show-error",
            "--fail-with-body",
            "--connect-timeout",
            "5",
            "--max-time",
            "10",
            "-H",
            &auth,
            "-H",
            "Accept: application/json",
            "https://api.todoist.com/api/v1/projects",
        ])?;
        let sections_body = run_curl(&[
            "--silent",
            "--show-error",
            "--fail-with-body",
            "--connect-timeout",
            "5",
            "--max-time",
            "10",
            "-H",
            &auth,
            "-H",
            "Accept: application/json",
            "https://api.todoist.com/api/v1/sections",
        ])?;
        let tasks_body = run_curl(&[
            "--silent",
            "--show-error",
            "--fail-with-body",
            "--connect-timeout",
            "5",
            "--max-time",
            "10",
            "-H",
            &auth,
            "-H",
            "Accept: application/json",
            "https://api.todoist.com/api/v1/tasks/filter?query=today%20%7C%20overdue&limit=200",
        ])?;
        let all_tasks_body = run_curl(&[
            "--silent",
            "--show-error",
            "--fail-with-body",
            "--connect-timeout",
            "5",
            "--max-time",
            "10",
            "-H",
            &auth,
            "-H",
            "Accept: application/json",
            "https://api.todoist.com/api/v1/tasks?limit=200",
        ])?;

        let projects: Vec<TodoistProject> = parse_list(&projects_body)?;
        let sections: Vec<TodoistSection> = parse_list(&sections_body)?;
        let parsed_tasks: TodoistFilterResponse = serde_json::from_str(&tasks_body)
            .map_err(|_| "Todoist returned an unexpected response.".to_string())?;
        let all_tasks: Vec<TodoistTask> = parse_list(&all_tasks_body)?;

        let mut boards = Vec::new();

        for project in &projects {

            let project_all_tasks: Vec<TodoistTask> = all_tasks
                .iter()
                .filter(|task| task.project_id.as_deref() == Some(project.id.as_str()))
                .cloned()
                .collect();

            let mut project_tasks: Vec<TodoistTask> = parsed_tasks
                .results
                .iter()
                .filter(|task| task.project_id.as_deref() == Some(project.id.as_str()))
                .cloned()
                .collect();

            for task in &mut project_tasks {
                let mut subtasks: Vec<TodoistTask> = project_all_tasks
                    .iter()
                    .filter(|candidate| candidate.parent_id.as_deref() == Some(task.id.as_str()))
                    .cloned()
                    .collect();
                subtasks.sort_by_key(|subtask| {
                    (
                        subtask.child_order.unwrap_or(9999),
                        subtask.content.to_lowercase(),
                    )
                });
                task.subtasks = subtasks;
            }

            project_tasks.sort_by_key(|task| {
                (
                    task.section_id.clone().unwrap_or_default(),
                    task.day_order.unwrap_or(task.child_order.unwrap_or(9999)),
                    task.content.to_lowercase(),
                )
            });

            let mut project_sections: Vec<TodoistSectionGroup> = sections
                .iter()
                .filter(|section| section.project_id.as_deref() == Some(project.id.as_str()))
                .map(|section| TodoistSectionGroup {
                    id: section.id.clone(),
                    name: section.name.clone(),
                    order: section.order.or(section.section_order).or(section.child_order).unwrap_or(9999),
                    tasks: Vec::new(),
                })
                .collect();

            project_sections.sort_by_key(|section| section.order);
            let mut loose_tasks = Vec::new();

            for task in project_tasks {
                if let Some(section_id) = task.section_id.as_deref() {
                    if let Some(group) = project_sections.iter_mut().find(|group| group.id == section_id) {
                        group.tasks.push(task);
                        continue;
                    }
                }
                loose_tasks.push(task);
            }

            project_sections.retain(|section| !section.tasks.is_empty());
            if !loose_tasks.is_empty() {
                project_sections.insert(0, TodoistSectionGroup {
                    id: "no-section".to_string(),
                    name: "No section".to_string(),
                    order: -1,
                    tasks: loose_tasks,
                });
            }

            boards.push(TodoistProjectBoard {
                label: project.name.clone(),
                project_id: Some(project.id.clone()),
                sections: project_sections,
            });
        }

        Ok(boards)
    })
    .await
    .map_err(|e| format!("Todoist task failed: {e}"))?
}

#[tauri::command]
pub async fn close_todoist_task(token: String, task_id: String) -> Result<(), String> {
    let token = token.trim().to_string();
    let task_id = task_id.trim().to_string();
    if token.is_empty() || task_id.is_empty() {
        return Err("Missing Todoist token or task id.".to_string());
    }

    tauri::async_runtime::spawn_blocking(move || {
        let auth = format!("Authorization: Bearer {token}");
        let url = format!("https://api.todoist.com/api/v1/tasks/{task_id}/close");
        run_curl(&[
            "--silent",
            "--show-error",
            "--fail-with-body",
            "--connect-timeout",
            "5",
            "--max-time",
            "10",
            "-X",
            "POST",
            "-H",
            &auth,
            "-H",
            "Accept: application/json",
            &url,
        ])?;
        Ok(())
    })
    .await
    .map_err(|e| format!("Todoist task failed: {e}"))?
}

#[tauri::command]
pub async fn create_todoist_task(
    token: String,
    content: String,
    project_id: Option<String>,
    section_id: Option<String>,
    due_string: Option<String>,
    priority: Option<i64>,
) -> Result<TodoistTask, String> {
    let token = token.trim().to_string();
    let content = content.trim().to_string();
    if token.is_empty() || content.is_empty() {
        return Err("Missing Todoist token or task content.".to_string());
    }

    tauri::async_runtime::spawn_blocking(move || {
        let auth = format!("Authorization: Bearer {token}");
        let mut fields = vec![
            format!(r#""content":"{}""#, json_escape(&content)),
        ];

        if let Some(due_string) = due_string.filter(|due| !due.trim().is_empty()) {
            fields.push(format!(r#""due_string":"{}""#, json_escape(due_string.trim())));
        }

        if let Some(priority) = priority.filter(|value| (1..=4).contains(value)) {
            fields.push(format!(r#""priority":{}"#, priority));
        }

        if let Some(project_id) = project_id.filter(|id| !id.trim().is_empty()) {
            fields.push(format!(r#""project_id":"{}""#, json_escape(project_id.trim())));
        }
        if let Some(section_id) = section_id.filter(|id| !id.trim().is_empty() && id != "no-section") {
            fields.push(format!(r#""section_id":"{}""#, json_escape(section_id.trim())));
        }

        let body = format!("{{{}}}", fields.join(","));
        let response = run_curl(&[
            "--silent",
            "--show-error",
            "--fail-with-body",
            "--connect-timeout",
            "5",
            "--max-time",
            "10",
            "-X",
            "POST",
            "-H",
            &auth,
            "-H",
            "Accept: application/json",
            "-H",
            "Content-Type: application/json",
            "-d",
            &body,
            "https://api.todoist.com/api/v1/tasks",
        ])?;

        serde_json::from_str::<TodoistTask>(&response)
            .map_err(|_| "Todoist returned an unexpected response.".to_string())
    })
    .await
    .map_err(|e| format!("Todoist task failed: {e}"))?
}
