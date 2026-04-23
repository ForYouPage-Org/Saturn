-- Seed baseline ESM survey. Idempotent via unique slug.

insert or ignore into esm_surveys (slug, title, questions, active) values (
  'baseline',
  'Quick check-in',
  '[
    {"id":"mood","type":"likert","prompt":"Right now, how are you feeling overall?","min":1,"max":7,"min_label":"Very bad","max_label":"Very good"},
    {"id":"reason","type":"choice","prompt":"What brought you to chat just now?","multiple":true,"options":["Homework / schoolwork","Curiosity","Bored","Social / emotional","Creative project","Other"]},
    {"id":"freeform","type":"text","prompt":"Anything else you want us to know about how you''re feeling?","placeholder":"Optional but helpful…","optional":true}
  ]',
  1
);
