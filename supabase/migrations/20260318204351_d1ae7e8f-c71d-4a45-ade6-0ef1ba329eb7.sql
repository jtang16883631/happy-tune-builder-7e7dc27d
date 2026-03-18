ALTER TABLE public.import_jobs ADD COLUMN IF NOT EXISTS package_status text NOT NULL DEFAULT 'none';
-- Values: 'none', 'building', 'ready', 'failed'
-- 'none' = no package build requested/needed
-- 'building' = package build in progress
-- 'ready' = package available for download
-- 'failed' = package build failed

ALTER TABLE public.import_jobs ADD COLUMN IF NOT EXISTS package_error text;
ALTER TABLE public.import_jobs ADD COLUMN IF NOT EXISTS package_path text;