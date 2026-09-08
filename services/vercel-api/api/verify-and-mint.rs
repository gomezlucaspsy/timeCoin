use economy_lib::{decide_mint, EconomyParams, WorkEvidence};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use vercel_runtime::{run, Body, Error, Request, Response, StatusCode};

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
async fn main() -> Result<(), Error> {
    run(handler).await
}

pub async fn handler(req: Request) -> Result<Response<Body>, Error> {
    let bytes: &[u8] = match req.body() {
        Body::Text(s) => s.as_bytes(),
        Body::Binary(b) => b.as_slice(),
        Body::Empty => &[],
    };

    let payload: VerifyRequest = match serde_json::from_slice(bytes) {
        Ok(p) => p,
        Err(_) => {
            return Ok(Response::builder()
                .status(StatusCode::BAD_REQUEST)
                .header("content-type", "application/json")
                .body(Body::Text(
                    serde_json::json!({ "approved": false, "reason": "invalid JSON body" })
                        .to_string(),
                ))?)
        }
    };

    // Serverless invocations don't share memory across requests, so the daily
    // mint cap can't be enforced here yet without a shared store (e.g. Vercel
    // Postgres). Tracked in README "Next steps".
    let evidence = WorkEvidence {
        worker_id: payload.worker_id,
        activity_hash: payload.activity_hash,
        confidence_score: payload.confidence_score,
        attestation_score: payload.attestation_score,
        worker_hours_already_minted_today: 0,
    };

    let decision = decide_mint(&EconomyParams::default(), &evidence);

    let (status, hour_token_id) = if decision.approved {
        (StatusCode::OK, Some(Uuid::new_v4()))
    } else {
        (StatusCode::UNPROCESSABLE_ENTITY, None)
    };

    let response = VerifyResponse {
        approved: decision.approved,
        reason: decision.reason,
        hour_token_id,
    };

    Ok(Response::builder()
        .status(status)
        .header("content-type", "application/json")
        .body(Body::Text(serde_json::to_string(&response)?))?)
}
