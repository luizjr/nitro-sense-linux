use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("I/O error reading {path}: {source}")]
    Io {
        path: String,
        #[source]
        source: std::io::Error,
    },

    #[error("hardware not supported: {0}")]
    Unsupported(String),

    #[error("invalid value: {0}")]
    InvalidValue(String),

    #[error("command failed: {0}")]
    Command(String),

    #[error("permission denied — run privileged helper or fix polkit rule")]
    Permission,
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
