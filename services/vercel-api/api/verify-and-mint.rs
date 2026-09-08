use economy_lib::{decide_mint, EconomyParams, WorkEvidence};
use http_body_util::BodyExt;
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;
use vercel_runtime::{run, service_fn, Error, Request, Response};

#[derive(Debug, Deserialize)]
struct VerifyRequest {
    worker_id: String,
    activity_hash: String,
    confidence_score: f64,
    attestation_score: f64,
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(service_fn(handler)).await
}

pub async fn handler(req: Request) -> Result<Response<Value>, Error> {
    let bytes = req.into_body().collect().await?.to_bytes();

    let payload: VerifyRequest = match serde_json::from_slice(&bytes) {
        Ok(p) => p,
        Err(_) => {
            return Ok(Response::builder()
                .status(400)
                .body(json!({ "approved": false, "reason": "invalid JSON body" }))?)
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
        (200, Some(Uuid::new_v4()))
    } else {
        (422, None)
    };

    Ok(Response::builder().status(status).body(json!({
        "approved": decision.approved,
        "reason": decision.reason,
        "hour_token_id": hour_token_id,
    }))?)
}
