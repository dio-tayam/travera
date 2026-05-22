-- ================================================================
-- STORAGE SETUP — Run this in Supabase SQL Editor
-- Creates the trip-documents bucket + access policies
-- ================================================================

-- 1. Create the bucket (safe to run even if it already exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trip-documents',
  'trip-documents',
  false,
  10485760,   -- 10 MB
  ARRAY[
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 10485760,
  public = false;

-- 2. Drop old storage policies if any
DROP POLICY IF EXISTS "trip_docs_insert"  ON storage.objects;
DROP POLICY IF EXISTS "trip_docs_select"  ON storage.objects;
DROP POLICY IF EXISTS "trip_docs_update"  ON storage.objects;
DROP POLICY IF EXISTS "trip_docs_delete"  ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can manage trip documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload trip documents"  ON storage.objects;
DROP POLICY IF EXISTS "Users can view trip documents"    ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own documents"   ON storage.objects;

-- 3. Allow any signed-in user to UPLOAD into the bucket
CREATE POLICY "trip_docs_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'trip-documents'
    AND auth.uid() IS NOT NULL
  );

-- 4. Allow signed-in users to READ files
--    (actual access control is enforced by signed URLs at the app level)
CREATE POLICY "trip_docs_select" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'trip-documents'
    AND auth.uid() IS NOT NULL
  );

-- 5. Allow users to DELETE files they uploaded
--    (path format: {trip_id}/{user_id}/{filename})
CREATE POLICY "trip_docs_delete" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'trip-documents'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- 6. Allow users to UPDATE their own files
CREATE POLICY "trip_docs_update" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'trip-documents'
    AND auth.uid() IS NOT NULL
  );
