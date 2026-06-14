CREATE TABLE IF NOT EXISTS token_blacklist (
  token TEXT PRIMARY KEY,
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_token_blacklist_expiry ON token_blacklist(expires_at);
