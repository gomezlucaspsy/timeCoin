use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EconomyParams {
    pub min_confidence: f64,
    pub min_attestation: f64,
    pub worker_daily_hour_cap: u8,
    pub audit_probability: f64,
}

impl Default for EconomyParams {
    fn default() -> Self {
        Self {
            min_confidence: 0.75,
            min_attestation: 0.70,
            worker_daily_hour_cap: 12,
            audit_probability: 0.08,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkEvidence {
    pub worker_id: String,
    pub activity_hash: String,
    pub confidence_score: f64,
    pub attestation_score: f64,
    pub worker_hours_already_minted_today: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MintDecision {
    pub approved: bool,
    pub reason: String,
}

#[derive(Debug, Error)]
pub enum EvidenceError {
    #[error("worker_id is required")]
    MissingWorkerId,
    #[error("activity_hash is required")]
    MissingActivityHash,
    #[error("confidence_score must be within [0,1]")]
    InvalidConfidence,
    #[error("attestation_score must be within [0,1]")]
    InvalidAttestation,
}

pub fn validate_evidence(e: &WorkEvidence) -> Result<(), EvidenceError> {
    if e.worker_id.trim().is_empty() {
        return Err(EvidenceError::MissingWorkerId);
    }
    if e.activity_hash.trim().is_empty() {
        return Err(EvidenceError::MissingActivityHash);
    }
    if !(0.0..=1.0).contains(&e.confidence_score) {
        return Err(EvidenceError::InvalidConfidence);
    }
    if !(0.0..=1.0).contains(&e.attestation_score) {
        return Err(EvidenceError::InvalidAttestation);
    }
    Ok(())
}

pub fn decide_mint(params: &EconomyParams, evidence: &WorkEvidence) -> MintDecision {
    if let Err(err) = validate_evidence(evidence) {
        return MintDecision {
            approved: false,
            reason: err.to_string(),
        };
    }

    if evidence.worker_hours_already_minted_today >= params.worker_daily_hour_cap {
        return MintDecision {
            approved: false,
            reason: "daily mint cap reached".to_string(),
        };
    }

    if evidence.confidence_score < params.min_confidence {
        return MintDecision {
            approved: false,
            reason: "confidence score below threshold".to_string(),
        };
    }

    if evidence.attestation_score < params.min_attestation {
        return MintDecision {
            approved: false,
            reason: "attestation score below threshold".to_string(),
        };
    }

    MintDecision {
        approved: true,
        reason: "approved: mint one hour NFT".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> WorkEvidence {
        WorkEvidence {
            worker_id: "did:timecoin:alice".to_string(),
            activity_hash: "0xabc123".to_string(),
            confidence_score: 0.9,
            attestation_score: 0.8,
            worker_hours_already_minted_today: 0,
        }
    }

    #[test]
    fn approves_valid_evidence() {
        let out = decide_mint(&EconomyParams::default(), &sample());
        assert!(out.approved);
    }

    #[test]
    fn rejects_low_confidence() {
        let mut e = sample();
        e.confidence_score = 0.1;
        let out = decide_mint(&EconomyParams::default(), &e);
        assert!(!out.approved);
        assert!(out.reason.contains("confidence"));
    }

    #[test]
    fn rejects_above_daily_cap() {
        let mut e = sample();
        e.worker_hours_already_minted_today = 12;
        let out = decide_mint(&EconomyParams::default(), &e);
        assert!(!out.approved);
        assert!(out.reason.contains("cap"));
    }
}
