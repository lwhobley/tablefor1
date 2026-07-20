CREATE INDEX match_poll_votes_user_idx
  ON public.match_poll_votes(user_id);

CREATE INDEX match_polls_creator_idx
  ON public.match_polls(creator_id);

CREATE INDEX safety_reports_match_idx
  ON public.safety_reports(match_id)
  WHERE match_id IS NOT NULL;

CREATE INDEX safety_reports_subject_idx
  ON public.safety_reports(subject_id)
  WHERE subject_id IS NOT NULL;
