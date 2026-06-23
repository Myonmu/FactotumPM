use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LlmProvider {
    #[serde(rename = "ollama")]
    Ollama,
    #[serde(rename = "lmstudio", alias = "lm_studio")]
    LmStudio,
    #[serde(rename = "openai", alias = "open_ai")]
    OpenAi,
    #[serde(rename = "custom")]
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LlmApiStyle {
    #[serde(rename = "openai", alias = "open_ai")]
    OpenAi,
    #[serde(rename = "ollama")]
    Ollama,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmConfig {
    pub provider: LlmProvider,
    pub base_url: String,
    pub model: String,
    pub api_key: Option<String>,
    pub api_style: LlmApiStyle,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmChatRequest {
    pub config: LlmConfig,
    pub messages: Vec<ChatMessage>,
    pub temperature: Option<f32>,
    pub json_mode: Option<bool>,
}

fn normalize_base_url(base_url: &str) -> String {
    base_url.trim().trim_end_matches('/').to_string()
}

fn build_http_client() -> Result<Client, String> {
    Client::builder()
        .timeout(Duration::from_secs(300))
        .build()
        .map_err(|err| err.to_string())
}

fn build_list_models_client() -> Result<Client, String> {
    Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|err| err.to_string())
}

fn is_likely_chat_model(id: &str) -> bool {
    let lower = id.to_lowercase();
    !(lower.contains("embed") || lower.contains("embedding") || lower.contains("rerank"))
}

fn dedupe_sorted(mut models: Vec<String>) -> Vec<String> {
    models.retain(|id| !id.trim().is_empty());
    models.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));
    models.dedup();
    models
}

async fn list_openai_compatible_models(client: &Client, config: &LlmConfig) -> Result<Vec<String>, String> {
    let base = normalize_base_url(&config.base_url);
    let url = format!("{base}/v1/models");

    let mut request = client.get(&url);
    if let Some(key) = &config.api_key {
        if !key.trim().is_empty() {
            request = request.bearer_auth(key.trim());
        }
    }

    let response = request.send().await.map_err(|err| {
        format!("Could not reach LLM at {url}: {err}")
    })?;
    let status = response.status();
    let payload: serde_json::Value = response.json().await.map_err(|err| err.to_string())?;

    if !status.is_success() {
        return Err(format!(
            "Failed to list models ({status}) at {url}: {}",
            payload
                .get("error")
                .and_then(|value| value.get("message"))
                .and_then(|value| value.as_str())
                .unwrap_or(&payload.to_string())
        ));
    }

    let models = payload
        .get("data")
        .and_then(|value| value.as_array())
        .map(|entries| {
            entries
                .iter()
                .filter_map(|entry| entry.get("id").and_then(|id| id.as_str()))
                .filter(|id| is_likely_chat_model(id))
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    if models.is_empty() {
        return Err(format!("No chat models returned from {url}"));
    }

    Ok(dedupe_sorted(models))
}

async fn list_ollama_models(client: &Client, config: &LlmConfig) -> Result<Vec<String>, String> {
    let base = normalize_base_url(&config.base_url);
    let url = format!("{base}/api/tags");

    let response = client.get(&url).send().await.map_err(|err| {
        format!("Could not reach Ollama at {url}: {err}")
    })?;
    let status = response.status();
    let payload: serde_json::Value = response.json().await.map_err(|err| err.to_string())?;

    if !status.is_success() {
        return Err(format!("Failed to list Ollama models ({status}): {payload}"));
    }

    let models = payload
        .get("models")
        .and_then(|value| value.as_array())
        .map(|entries| {
            entries
                .iter()
                .filter_map(|entry| {
                    entry
                        .get("name")
                        .or_else(|| entry.get("model"))
                        .and_then(|name| name.as_str())
                })
                .filter(|id| is_likely_chat_model(id))
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    if models.is_empty() {
        return Err(format!("No models returned from {url}"));
    }

    Ok(dedupe_sorted(models))
}

async fn list_models_with_config(config: LlmConfig) -> Result<Vec<String>, String> {
    let client = build_list_models_client()?;

    match config.api_style {
        LlmApiStyle::OpenAi => list_openai_compatible_models(&client, &config).await,
        LlmApiStyle::Ollama => list_ollama_models(&client, &config).await,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmChatResponse {
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning_content: Option<String>,
}

fn extract_assistant_message(payload: &serde_json::Value) -> Option<LlmChatResponse> {
    let message = payload
        .get("choices")?
        .get(0)?
        .get("message")?;

    let content = message
        .get("content")
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .unwrap_or_default();

    let reasoning_content = ["reasoning_content", "reasoning"]
        .iter()
        .find_map(|key| {
            message
                .get(*key)
                .and_then(|value| value.as_str())
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string)
        });

    if content.is_empty() && reasoning_content.is_none() {
        return None;
    }

    Some(LlmChatResponse {
        content,
        reasoning_content,
    })
}

async fn chat_openai_compatible(
    client: &Client,
    config: &LlmConfig,
    messages: &[ChatMessage],
    temperature: Option<f32>,
    json_mode: bool,
) -> Result<LlmChatResponse, String> {
    let base = normalize_base_url(&config.base_url);
    let url = format!("{base}/v1/chat/completions");

    let mut body = serde_json::json!({
        "model": config.model,
        "messages": messages,
        "temperature": temperature.unwrap_or(0.4),
    });

    if json_mode {
        body["response_format"] = serde_json::json!({ "type": "json_object" });
    }

    let mut request = client.post(&url).json(&body);
    if let Some(key) = &config.api_key {
        if !key.trim().is_empty() {
            request = request.bearer_auth(key.trim());
        }
    }

    let response = request.send().await.map_err(|err| {
        format!(
            "Could not reach LLM at {url}: {err}. Check that the server is running and the base URL is correct."
        )
    })?;
    let status = response.status();
    let payload: serde_json::Value = response.json().await.map_err(|err| {
        format!("LLM at {url} returned a non-JSON response: {err}")
    })?;

    if !status.is_success() {
        return Err(format!(
            "LLM request failed ({status}) at {url}: {}",
            payload
                .get("error")
                .and_then(|value| value.get("message"))
                .and_then(|value| value.as_str())
                .unwrap_or(&payload.to_string())
        ));
    }

    extract_assistant_message(&payload)
        .ok_or_else(|| format!("Unexpected LLM response shape from {url}: {payload}"))
}

async fn chat_ollama_native(
    client: &Client,
    config: &LlmConfig,
    messages: &[ChatMessage],
    temperature: Option<f32>,
    json_mode: bool,
) -> Result<LlmChatResponse, String> {
    let base = normalize_base_url(&config.base_url);
    let url = format!("{base}/api/chat");

    let mut body = serde_json::json!({
        "model": config.model,
        "messages": messages,
        "stream": false,
        "options": {
            "temperature": temperature.unwrap_or(0.4),
        }
    });

    if json_mode {
        body["format"] = serde_json::json!("json");
    }

    let response = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|err| {
            format!(
                "Could not reach Ollama at {url}: {err}. Check that Ollama is running."
            )
        })?;

    let status = response.status();
    let payload: serde_json::Value = response.json().await.map_err(|err| err.to_string())?;

    if !status.is_success() {
        return Err(format!("Ollama request failed ({status}): {payload}"));
    }

    let content = payload
        .get("message")
        .and_then(|message| message.get("content"))
        .and_then(|content| content.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .ok_or_else(|| format!("Unexpected Ollama response shape: {payload}"))?;

    Ok(LlmChatResponse {
        content,
        reasoning_content: None,
    })
}

async fn chat_with_config(request: LlmChatRequest) -> Result<LlmChatResponse, String> {
    if request.messages.is_empty() {
        return Err("At least one chat message is required".into());
    }

    let client = build_http_client()?;
    let json_mode = request.json_mode.unwrap_or(false);

    match request.config.api_style {
        LlmApiStyle::OpenAi => {
            chat_openai_compatible(
                &client,
                &request.config,
                &request.messages,
                request.temperature,
                json_mode,
            )
            .await
        }
        LlmApiStyle::Ollama => {
            chat_ollama_native(
                &client,
                &request.config,
                &request.messages,
                request.temperature,
                json_mode,
            )
            .await
        }
    }
}

#[tauri::command]
pub async fn llm_chat(request: LlmChatRequest) -> Result<LlmChatResponse, String> {
    chat_with_config(request).await
}

#[tauri::command]
pub async fn llm_test_connection(config: LlmConfig) -> Result<String, String> {
    let request = LlmChatRequest {
        config,
        messages: vec![ChatMessage {
            role: "user".into(),
            content: "Reply with exactly: ok".into(),
        }],
        temperature: Some(0.0),
        json_mode: None,
    };

    let reply = chat_with_config(request).await?;
    let visible = if reply.content.is_empty() {
        reply.reasoning_content.unwrap_or_default()
    } else {
        reply.content
    };
    Ok(visible.trim().to_string())
}

#[tauri::command]
pub async fn llm_list_models(config: LlmConfig) -> Result<Vec<String>, String> {
    list_models_with_config(config).await
}
