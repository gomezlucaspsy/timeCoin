use axum::{
    extract::State,
    http::StatusCode,
    response::Html,
    routing::{get, post},
    Json, Router,
};
use economy_lib::{decide_mint, EconomyParams, WorkEvidence};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, net::SocketAddr, sync::Arc};
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Clone)]
struct AppState {
    params: EconomyParams,
    minted_hours_by_worker_today: Arc<RwLock<HashMap<String, u8>>>,
}

#[derive(Debug, Deserialize)]
struct VerifyRequest {
    worker_id: String,
    activity_hash: String,
    confidence_score: f64,
    attestation_score: f64,
}

#[derive(Debug, Serialize)]
struct VerifyResponse {
    approved: bool,
    reason: String,
    hour_token_id: Option<Uuid>,
}

#[tokio::main]
async fn main() {
    let state = AppState {
        params: EconomyParams::default(),
        minted_hours_by_worker_today: Arc::new(RwLock::new(HashMap::new())),
    };

    let app = Router::new()
        .route("/", get(index))
        .route("/health", get(health))
        .route("/v1/verify-and-mint", post(verify_and_mint))
        .with_state(state);

    let addr = SocketAddr::from(([127, 0, 0, 1], 8080));
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("bind server listener");

    println!("timecoin-api listening on http://{}", addr);
    axum::serve(listener, app).await.expect("run server");
}

async fn health() -> &'static str {
    "ok"
}

async fn index() -> Html<&'static str> {
        Html(
                r#"<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>TimeCoin API</title>
    <style>
        :root {
            --bg: #f8f6ef;
            --panel: #fffdf7;
            --ink: #1f2a1f;
            --muted: #5a6456;
            --line: #d9dfcf;
            --accent: #1d8f4e;
            --accent-2: #0f5f99;
            --code: #f1f5ea;
        }

        * { box-sizing: border-box; }

        body {
            margin: 0;
            font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
            color: var(--ink);
            background:
                radial-gradient(1200px 500px at -10% -20%, #fff8d9 0%, transparent 60%),
                radial-gradient(900px 400px at 110% -30%, #dff4e7 0%, transparent 60%),
                var(--bg);
            min-height: 100vh;
        }

        .wrap {
            max-width: 980px;
            margin: 48px auto;
            padding: 0 20px 32px;
        }

        .hero {
            border: 1px solid var(--line);
            border-radius: 20px;
            background: var(--panel);
            padding: 28px;
            box-shadow: 0 12px 35px rgba(19, 38, 20, 0.08);
        }

        .badge {
            display: inline-block;
            border: 1px solid #8ac7a2;
            color: #10663a;
            background: #eaf9f0;
            border-radius: 999px;
            padding: 6px 12px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
        }

        h1 {
            margin: 14px 0 8px;
            font-size: clamp(1.8rem, 4vw, 2.8rem);
            line-height: 1.05;
            letter-spacing: -0.02em;
        }

        p {
            margin: 0;
            color: var(--muted);
            font-size: 1rem;
        }

        .grid {
            margin-top: 22px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
            gap: 16px;
        }

        .card {
            border: 1px solid var(--line);
            border-radius: 14px;
            background: #ffffff;
            padding: 16px;
        }

        .card h2 {
            margin: 0 0 10px;
            font-size: 1rem;
        }

        code, pre {
            font-family: "Consolas", "SFMono-Regular", Menlo, Monaco, monospace;
            font-size: 0.88rem;
        }

        pre {
            margin: 8px 0 0;
            padding: 12px;
            background: var(--code);
            border: 1px solid #dfe8d5;
            border-radius: 10px;
            overflow-x: auto;
            white-space: pre-wrap;
            word-break: break-word;
        }

        .row {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 14px;
        }

        .pill {
            border: 1px solid var(--line);
            border-left-width: 4px;
            border-radius: 10px;
            background: #fff;
            padding: 8px 10px;
            font-size: 0.88rem;
        }

        .pill.get { border-left-color: var(--accent-2); }
        .pill.post { border-left-color: var(--accent); }

        .ok {
            margin-top: 16px;
            color: #0f6c3f;
            font-weight: 700;
        }
    </style>
</head>
<body>
    <main class="wrap">
        <section class="hero">
            <span class="badge">TimeCoin Service Online</span>
            <h1>TimeCoin API</h1>
            <p>
                Scientifically grounded mint gate for one-hour labor credits.
                This endpoint service verifies evidence and decides whether minting is approved.
            </p>

            <div class="row">
                <div class="pill get"><strong>GET</strong> /health</div>
                <div class="pill post"><strong>POST</strong> /v1/verify-and-mint</div>
            </div>

            <div class="grid">
                <article class="card">
                    <h2>Health Check</h2>
                    <pre>curl http://127.0.0.1:8080/health</pre>
                </article>

                <article class="card">
                    <h2>Mint Decision Test (PowerShell)</h2>
                    <pre>$body = @{ worker_id = 'did:timecoin:alice'; activity_hash = '0xabc'; confidence_score = 0.91; attestation_score = 0.85 } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8080/v1/verify-and-mint' -ContentType 'application/json' -Body $body</pre>
                </article>
            </div>

            <p class="ok">Status: running on http://127.0.0.1:8080</p>
        </section>
    </main>
</body>
</html>"#,
        )
}

async fn verify_and_mint(
    State(state): State<AppState>,
    Json(req): Json<VerifyRequest>,
) -> Result<Json<VerifyResponse>, (StatusCode, Json<VerifyResponse>)> {
    let already_minted_today = {
        let lock = state.minted_hours_by_worker_today.read().await;
        *lock.get(&req.worker_id).unwrap_or(&0)
    };

    let evidence = WorkEvidence {
        worker_id: req.worker_id.clone(),
        activity_hash: req.activity_hash,
        confidence_score: req.confidence_score,
        attestation_score: req.attestation_score,
        worker_hours_already_minted_today: already_minted_today,
    };

    let decision = decide_mint(&state.params, &evidence);

    if !decision.approved {
        return Err((
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(VerifyResponse {
                approved: false,
                reason: decision.reason,
                hour_token_id: None,
            }),
        ));
    }

    {
        let mut lock = state.minted_hours_by_worker_today.write().await;
        let entry = lock.entry(req.worker_id).or_insert(0);
        *entry = entry.saturating_add(1);
    }

    Ok(Json(VerifyResponse {
        approved: true,
        reason: decision.reason,
        hour_token_id: Some(Uuid::new_v4()),
    }))
}
