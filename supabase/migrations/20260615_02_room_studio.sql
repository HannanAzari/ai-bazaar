-- Room Engine V2 (Creator Studio): objects gain explicit box dimensions for
-- corner-resize handles, stored alongside the existing uniform `scale`.
-- Both are nullable for back-compat: rooms saved before V2 carry only `scale`
-- and fall back to the base tile size in the renderer. When present, each side
-- must be positive (resize never persists a zero/negative size).

alter table public.room_objects
  add column if not exists width real check (width is null or width > 0),
  add column if not exists height real check (height is null or height > 0);
