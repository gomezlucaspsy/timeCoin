use vercel_runtime::{run, service_fn, Error, Request};

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(service_fn(handler)).await
}

pub async fn handler(_req: Request) -> Result<&'static str, Error> {
    Ok("ok")
}
