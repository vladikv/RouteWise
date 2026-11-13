-- Soft delete: DELETE /api/trips/{id} sets deleted_at; POST /api/trips/{id}/restore clears it
-- within the restore window. NULL means the trip is active. Queries filter on it per owner.
ALTER TABLE trip ADD COLUMN deleted_at TIMESTAMP(6) WITH TIME ZONE;

CREATE INDEX ix_trip_owner_deleted ON trip (owner_id, deleted_at);
