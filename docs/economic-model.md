# TimeCoin Scientific Economic Model (MVP)

## Objective

Design a system where exactly one verified labor hour mints one non-fungible hour credit, while keeping fraud losses low and redemption demand high.

## Core invariants

- Invariant 1: one accepted work event mints at most one hour token.
- Invariant 2: issuance only follows verified evidence and attestation.
- Invariant 3: every token has traceable provenance metadata.
- Invariant 4: mint thresholds are explicit and auditable.

## Mint gate equation

Mint one hour token if and only if:

$$
c \ge c_{min} \land a \ge a_{min} \land h_{worker,day} < h_{cap}
$$

Where:

- $c$ is AI confidence score in $[0,1]$.
- $a$ is attestation score in $[0,1]$.
- $h_{worker,day}$ is worker minted hours today.
- $h_{cap}$ is daily mint cap.

## Calibration defaults

- $c_{min} = 0.75$
- $a_{min} = 0.70$
- $h_{cap} = 12$
- audit probability $p_{audit} = 0.08$

## Why this is scientifically possible

- Uses measurable signals: activity logs, attestation, historical behavior.
- Uses falsifiable thresholds: metrics can prove whether policy works.
- Uses feedback loops: tune thresholds from observed fraud and redemption outcomes.

## Pilot metrics to monitor

- Verification pass rate
- Fraud-loss ratio
- Dispute rate
- 30-day redemption ratio
- Median time from mint to redeem
- Weekly active retention

## Scalability strategy

- Stateless API workers behind a load balancer.
- Shared database for evidence and token records.
- Asynchronous scoring pipeline for heavy AI checks.
- Cache hot identity and reputation lookups.
- Append-only event log for forensic and economic analysis.
