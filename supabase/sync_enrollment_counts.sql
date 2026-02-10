-- Migration: Sync Enrollment Counts
-- Adds enrolled_count and open_rate to email_sequences and keeps them updated via triggers

-- 1. Add columns if they don't exist
ALTER TABLE email_sequences ADD COLUMN IF NOT EXISTS enrolled_count INTEGER DEFAULT 0;
ALTER TABLE email_sequences ADD COLUMN IF NOT EXISTS open_rate FLOAT DEFAULT 0;

-- 2. Create function to calculate and update stats
CREATE OR REPLACE FUNCTION update_sequence_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update counts for the affected sequence
  -- We handle both NEW and OLD to cover INSERT, UPDATE, DELETE (though usually just INSERT/DELETE changes count)
  
  IF (TG_OP = 'INSERT') THEN
    UPDATE email_sequences
    SET enrolled_count = (SELECT count(*) FROM sequence_enrollments WHERE sequence_id = NEW.sequence_id)
    WHERE id = NEW.sequence_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE email_sequences
    SET enrolled_count = (SELECT count(*) FROM sequence_enrollments WHERE sequence_id = OLD.sequence_id)
    WHERE id = OLD.sequence_id;
  ELSIF (TG_OP = 'UPDATE') THEN
    -- If sequence_id changed (unlikely but possible), update both
    IF (OLD.sequence_id != NEW.sequence_id) THEN
      UPDATE email_sequences
      SET enrolled_count = (SELECT count(*) FROM sequence_enrollments WHERE sequence_id = OLD.sequence_id)
      WHERE id = OLD.sequence_id;
      
      UPDATE email_sequences
      SET enrolled_count = (SELECT count(*) FROM sequence_enrollments WHERE sequence_id = NEW.sequence_id)
      WHERE id = NEW.sequence_id;
    END IF;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create Trigger
DROP TRIGGER IF EXISTS trigger_update_sequence_stats ON sequence_enrollments;

CREATE TRIGGER trigger_update_sequence_stats
AFTER INSERT OR UPDATE OR DELETE ON sequence_enrollments
FOR EACH ROW
EXECUTE FUNCTION update_sequence_stats();

-- 4. Backfill existing counts
UPDATE email_sequences
SET enrolled_count = (
  SELECT count(*) 
  FROM sequence_enrollments 
  WHERE sequence_enrollments.sequence_id = email_sequences.id
);
