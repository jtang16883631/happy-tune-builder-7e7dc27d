-- Add multi-sheet support for cost data + per-section sheet mapping
ALTER TABLE public.template_sections
ADD COLUMN IF NOT EXISTS cost_sheet text;

ALTER TABLE public.template_cost_items
ADD COLUMN IF NOT EXISTS sheet_name text;

-- Helpful indexes for lookup/filtering
CREATE INDEX IF NOT EXISTS idx_template_cost_items_template_id_sheet_name
ON public.template_cost_items (template_id, sheet_name);

CREATE INDEX IF NOT EXISTS idx_template_sections_template_id_cost_sheet
ON public.template_sections (template_id, cost_sheet);