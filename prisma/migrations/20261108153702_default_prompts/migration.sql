-- Default saved prompts for the company chat (mficrm-bwv.3). One-time: deleting them later is respected.
INSERT INTO "ai_prompts" ("name", "text", "rank") VALUES
  ('Summarise', 'Summarise {{company}}: what it does, how it makes money, how big it is and how long it has been running.', 0),
  ('Valuation check', 'Is the asking price of {{asking_price}} reasonable for the profit shown? Give the multiple and show how you worked it out.', 1),
  ('Revenue and profit trend', 'How have revenue and profit trended over the period the P&L covers? Point out any unusual months.', 2),
  ('Expenses', 'What are the biggest expense lines, and which could be cut or improved after the acquisition?', 3),
  ('Risks and red flags', 'What are the main risks and red flags for a buyer of {{company}}?', 4),
  ('Questions for the seller', 'List the questions I should ask the seller before making an offer, most important first.', 5),
  ('Check my notes', 'Check my notes against the documents: is anything wrong, missing or inconsistent?', 6);
