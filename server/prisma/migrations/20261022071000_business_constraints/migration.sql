-- Business rules enforced at the database level (defence in depth; the API checks these too)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Leave dates must be a valid range and day count positive
ALTER TABLE "leave_requests"
  ADD CONSTRAINT "leave_dates_valid" CHECK ("end_date" >= "start_date"),
  ADD CONSTRAINT "leave_days_positive" CHECK ("days" > 0);

-- An employee cannot hold two overlapping PENDING/APPROVED leave requests
ALTER TABLE "leave_requests"
  ADD CONSTRAINT "leave_no_overlap" EXCLUDE USING gist (
    "employee_id" WITH =,
    daterange("start_date", "end_date", '[]') WITH &&
  ) WHERE ("status" IN ('PENDING', 'APPROVED'));

-- An employee cannot be their own manager
ALTER TABLE "employees"
  ADD CONSTRAINT "employee_not_own_manager" CHECK ("manager_id" IS NULL OR "manager_id" <> "id");
