use std::path::PathBuf;
use std::sync::Mutex;
use tiny_http::{Header, Response, Server};
use walkdir::WalkDir;

#[allow(dead_code)]
pub struct McpServerState(pub Mutex<Option<()>>);

impl McpServerState {
    pub fn new() -> Self {
        Self(Mutex::new(None))
    }
}

#[derive(serde::Serialize, serde::Deserialize)]
struct JsonRpcRequest {
    jsonrpc: String,
    method: String,
    #[serde(default)]
    params: serde_json::Value,
    id: serde_json::Value,
}

#[derive(serde::Serialize)]
struct JsonRpcResponse<T: serde::Serialize> {
    jsonrpc: &'static str,
    result: T,
    id: serde_json::Value,
}

#[derive(serde::Serialize)]
struct JsonRpcError {
    jsonrpc: &'static str,
    error: JsonRpcErrorBody,
    id: serde_json::Value,
}

#[derive(serde::Serialize)]
struct JsonRpcErrorBody {
    code: i32,
    message: String,
}

fn ok<T: serde::Serialize>(result: T, id: serde_json::Value) -> String {
    serde_json::to_string(&JsonRpcResponse { jsonrpc: "2.0", result, id }).unwrap()
}

fn err(msg: &str, id: serde_json::Value) -> String {
    serde_json::to_string(&JsonRpcError {
        jsonrpc: "2.0",
        error: JsonRpcErrorBody { code: -32603, message: msg.to_string() },
        id,
    })
    .unwrap()
}

fn handle_request(body: &str, vault_path: &str) -> String {
    let req: JsonRpcRequest = match serde_json::from_str(body) {
        Ok(r) => r,
        Err(e) => return format!(r#"{{"jsonrpc":"2.0","error":{{"code":-32700,"message":"{e}"}},"id":null}}"#),
    };
    let id = req.id.clone();

    match req.method.as_str() {
        // MCP initialize
        "initialize" => ok(serde_json::json!({
            "protocolVersion": "2024-11-05",
            "capabilities": { "tools": {} },
            "serverInfo": { "name": "noteplan", "version": "1.0.0" }
        }), id),

        // MCP tool list
        "tools/list" => ok(serde_json::json!({ "tools": [
            { "name": "list_notes",     "description": "List all notes in the vault", "inputSchema": { "type": "object", "properties": {} } },
            { "name": "get_note",       "description": "Get note content by file path", "inputSchema": { "type": "object", "properties": { "path": { "type": "string" } }, "required": ["path"] } },
            { "name": "search_notes",   "description": "Search notes by keyword", "inputSchema": { "type": "object", "properties": { "query": { "type": "string" } }, "required": ["query"] } },
            { "name": "create_note",    "description": "Create a new note", "inputSchema": { "type": "object", "properties": { "path": { "type": "string" }, "content": { "type": "string" } }, "required": ["path", "content"] } },
            { "name": "update_note",    "description": "Update note content", "inputSchema": { "type": "object", "properties": { "path": { "type": "string" }, "content": { "type": "string" } }, "required": ["path", "content"] } },
            { "name": "get_today_note", "description": "Get today's daily note", "inputSchema": { "type": "object", "properties": {} } },
        ]}), id),

        // MCP tool call
        "tools/call" => {
            let tool_name = req.params["name"].as_str().unwrap_or("").to_string();
            let args = &req.params["arguments"];
            handle_tool_call(&tool_name, args, vault_path, id)
        }

        _ => err(&format!("Method not found: {}", req.method), id),
    }
}

fn handle_tool_call(
    tool: &str,
    args: &serde_json::Value,
    vault_path: &str,
    id: serde_json::Value,
) -> String {
    match tool {
        "list_notes" => {
            let notes: Vec<serde_json::Value> = WalkDir::new(vault_path)
                .into_iter()
                .filter_map(|e| e.ok())
                .filter(|e| e.path().extension().map_or(false, |x| x == "md"))
                .map(|e| {
                    let path = e.path().to_string_lossy().to_string();
                    let title = e.path()
                        .file_stem()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();
                    serde_json::json!({ "path": path, "title": title })
                })
                .collect();
            ok(serde_json::json!({ "content": [{ "type": "text", "text": serde_json::to_string_pretty(&notes).unwrap() }] }), id)
        }

        "get_note" | "update_note" if tool == "get_note" => {
            let path = args["path"].as_str().unwrap_or("");
            match std::fs::read_to_string(path) {
                Ok(content) => ok(serde_json::json!({ "content": [{ "type": "text", "text": content }] }), id),
                Err(e) => err(&e.to_string(), id),
            }
        }

        "update_note" => {
            let path = args["path"].as_str().unwrap_or("");
            let content = args["content"].as_str().unwrap_or("");
            match std::fs::write(path, content) {
                Ok(_) => ok(serde_json::json!({ "content": [{ "type": "text", "text": "Note updated." }] }), id),
                Err(e) => err(&e.to_string(), id),
            }
        }

        "create_note" => {
            let path = args["path"].as_str().unwrap_or("");
            let content = args["content"].as_str().unwrap_or("");
            let full = if path.starts_with('/') {
                PathBuf::from(path)
            } else {
                PathBuf::from(vault_path).join(path)
            };
            if let Some(parent) = full.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            match std::fs::write(&full, content) {
                Ok(_) => ok(serde_json::json!({ "content": [{ "type": "text", "text": full.to_string_lossy().to_string() }] }), id),
                Err(e) => err(&e.to_string(), id),
            }
        }

        "search_notes" => {
            let query = args["query"].as_str().unwrap_or("").to_lowercase();
            let results: Vec<serde_json::Value> = WalkDir::new(vault_path)
                .into_iter()
                .filter_map(|e| e.ok())
                .filter(|e| e.path().extension().map_or(false, |x| x == "md"))
                .filter_map(|e| {
                    let content = std::fs::read_to_string(e.path()).ok()?;
                    if content.to_lowercase().contains(&query) {
                        let start = content.to_lowercase().find(&query)?;
                        let excerpt = content[start.saturating_sub(40)..std::cmp::min(start + 120, content.len())].to_string();
                        Some(serde_json::json!({
                            "path": e.path().to_string_lossy().to_string(),
                            "title": e.path().file_stem().unwrap_or_default().to_string_lossy().to_string(),
                            "excerpt": excerpt
                        }))
                    } else { None }
                })
                .take(20)
                .collect();
            ok(serde_json::json!({ "content": [{ "type": "text", "text": serde_json::to_string_pretty(&results).unwrap() }] }), id)
        }

        "get_today_note" => {
            let today = chrono::Local::now().format("%Y%m%d").to_string();
            let path = PathBuf::from(vault_path).join("Daily").join(format!("{today}.md"));
            let content = std::fs::read_to_string(&path)
                .unwrap_or_else(|_| format!("# {today}\n\n(No content yet)"));
            ok(serde_json::json!({ "content": [{ "type": "text", "text": content }] }), id)
        }

        _ => err(&format!("Unknown tool: {tool}"), id),
    }
}

#[tauri::command]
pub fn start_mcp_server(
    vault_path: String,
    port: u16,
) -> Result<u16, String> {
    let addr = format!("127.0.0.1:{port}");
    let server = Server::http(&addr).map_err(|e| e.to_string())?;
    let vault = vault_path.clone();

    std::thread::spawn(move || {
        for mut request in server.incoming_requests() {
            let mut body = String::new();
            let _ = request.as_reader().read_to_string(&mut body);

            let response_body = handle_request(&body, &vault);

            let response = Response::from_string(response_body)
                .with_header(
                    Header::from_bytes("Content-Type", "application/json").unwrap(),
                )
                .with_header(
                    Header::from_bytes("Access-Control-Allow-Origin", "*").unwrap(),
                );
            let _ = request.respond(response);
        }
    });

    Ok(port)
}

#[tauri::command]
pub fn get_mcp_config(vault_path: String, port: u16) -> String {
    serde_json::to_string_pretty(&serde_json::json!({
        "mcpServers": {
            "daymark": {
                "url": format!("http://127.0.0.1:{port}"),
                "description": format!("Manager vault at {vault_path}")
            }
        }
    }))
    .unwrap()
}
