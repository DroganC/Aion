-- Trim the official agent catalog to Aion CLI + OpenCode + Pi.
-- Custom and extension rows are left untouched.
--
-- Kept:
--   632f31d2  Aion CLI   (agent_source=internal, agent_type=aionrs)
--   53861a53  OpenCode   (agent_source=builtin, backend=opencode)
--   484e4bf2  Pi         (agent_source=builtin, backend=pi)
--
-- Also removes Amp (ca45e378 / amp-acp) and every other official builtin
-- previously seeded by 001/011/023/025/029/031/034.

DELETE FROM agent_metadata
WHERE agent_source IN ('builtin', 'internal')
  AND id NOT IN ('632f31d2', '53861a53', '484e4bf2')
  AND agent_id NOT IN ('632f31d2', '53861a53', '484e4bf2');
