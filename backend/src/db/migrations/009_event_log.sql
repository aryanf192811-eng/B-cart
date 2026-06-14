CREATE TABLE IF NOT EXISTS event_log (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
  error_msg TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP,
  retry_count INT DEFAULT 0
);

CREATE INDEX idx_event_log_status ON event_log(status) WHERE status = 'pending';
