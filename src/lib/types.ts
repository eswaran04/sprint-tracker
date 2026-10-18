export type Difficulty = "Basic" | "Core" | "Pro";

export interface ProblemInput {
  position: number;
  name: string;
  url: string;
  subject: string;
  difficulty: Difficulty | null;
  companies: string[];
  topics: string[];
  sprint_no: number;
  day_no: number;
}

export interface Problem extends ProblemInput {
  id: string;
  sprint_id: string;
  original_day_no: number;
  original_sprint_no: number | null;
  source_id: string | null;
  done_at: string | null;
  starred: boolean;
  notes: string;
  updated_at?: string;
}

export interface Sprint {
  id: string;
  user_id: string;
  title: string;
  start_date: string | null; // yyyy-MM-dd
  skip_weekends: boolean;
  rest_days: string[]; // yyyy-MM-dd
  visibility: "private" | "public";
  description: string;
  show_owner: boolean;
  owner_name: string | null;
  owner_avatar: string | null;
  published_at: string | null;
  copied_from: string | null;
  copy_count: number;
  created_at: string;
  updated_at?: string;
}

export interface SavedFilter {
  id: string;
  user_id: string;
  name: string;
  query: Record<string, unknown>;
  created_at: string;
}

/** Row of the `public_sheets` view — catalogue summary, never the owner's progress. */
export interface PublicSheet {
  id: string;
  title: string;
  description: string;
  owner_name: string | null;
  owner_avatar: string | null;
  published_at: string | null;
  copy_count: number;
  problem_count: number;
  day_count: number;
  sprint_count: number;
  basic_count: number;
  core_count: number;
  pro_count: number;
  topics: string[];
  company_counts: Record<string, number>;
}

/** Row of the `public_sheet_problems` view. */
export type PublicProblem = Pick<
  Problem,
  "id" | "sprint_id" | "position" | "name" | "url" | "subject" | "difficulty" | "companies" | "topics" | "sprint_no" | "day_no"
>;

export interface Group {
  id: string;
  owner_id: string;
  sprint_id: string;
  name: string;
  invite_code: string;
  created_at: string;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  sprint_id: string;
  display_name: string;
  avatar: string | null;
  role: "owner" | "member";
  joined_at: string;
}

/** Row of `my_groups()`: a group you belong to, with your linked sprint. */
export interface MyGroup {
  id: string;
  name: string;
  invite_code: string;
  role: "owner" | "member";
  sprint_id: string;
  member_count: number;
}

/** Row of `group_preview(code)`. */
export interface GroupPreview {
  id: string;
  name: string;
  owner_name: string | null;
  member_count: number;
  sheet_title: string;
  problem_count: number;
  day_count: number;
  my_sprint_id: string | null;
  existing_copy_id: string | null;
}

/** Row of `group_progress(group)`: one completed problem for one member. */
export interface GroupProgressRow {
  user_id: string;
  problem_key: string;
  done_at: string;
}

/** Row of `group_activity(group)`: one problem a member completed recently. */
export interface GroupActivityRow {
  user_id: string;
  problem_name: string;
  done_at: string;
}

/** A 👏 from `reactor` on `target_user`'s solves for `day` (yyyy-MM-dd). */
export interface GroupReaction {
  group_id: string;
  target_user: string;
  day: string;
  reactor: string;
}

/** Weighted completion of one company's problems (Basic 1 · Core 2 · Pro 3). */
export interface CompanyReadiness {
  company: string;
  /** 0–100. */
  score: number;
  done: number;
  total: number;
  /** "low" when the sample is small; the card marks it as early. */
  confidence: "high" | "low";
}

/** The 2-line "AI Scout Report" plus the buckets it was written from. */
export interface ScoutReport {
  line1: string;
  line2: string;
  strengths: string[];
  weaknesses: string[];
  /** False when the built-in template wrote it (AI off or failed). */
  ai: boolean;
}

export interface ReportStats {
  pct: number;
  done: number;
  total: number;
  streak: number;
  longest: number;
  pro_done: number;
  pro_total: number;
}

/** Public readiness-report snapshot (`share_report(slug)`). */
export interface ShareReport {
  slug: string;
  sprint_id: string;
  title: string;
  owner_name: string | null;
  owner_avatar: string | null;
  readiness: CompanyReadiness[];
  scout: ScoutReport;
  stats: ReportStats;
  updated_at: string;
}

/** Row of `shared_roadmap(slug)`: catalogue columns plus a done flag. */
export type SharedProblem = Omit<PublicProblem, "id" | "sprint_id"> & { done: boolean };

/** Row of `my_nudges()`. */
export interface MyNudge {
  id: string;
  group_id: string;
  group_name: string;
  sender_name: string;
  created_at: string;
  /** Optional note from the sender (≤ 140 chars). Plain text: render it, never as HTML. */
  message: string | null;
}

/** A problem as the weekly digest refers to it (catalogue fields only, never notes or stars). */
export interface DigestProblem {
  key: string;
  name: string;
  url: string;
  difficulty: Difficulty | null;
}

/** Deterministic facts behind the weekly digest. The model may only reword these. */
export interface DigestFacts {
  groupName: string;
  me: { userId: string; name: string; weekSolves: number; streak: number; done: number };
  memberCount: number;
  /** Solves in the last 7 days across the group. */
  weekSolves: number;
  /** Top members by solves this week (max 3, solves > 0). */
  weekly: { userId: string; name: string; solves: number; streak: number }[];
  /** Members who finished a whole sprint with the last solve in the past 7 days (max 3). */
  cleared: { userId: string; name: string; sprintNo: number; problems: number }[];
  /** Where you stand: overdue count vs your plan (null without a start date) and the closest peer ahead. */
  behind: { overdue: number | null; planDay: number | null; ahead: { userId: string; name: string; by: number } | null };
  /** Problems a teammate solved that you haven't (max 3). */
  pairUp: { partner: { userId: string; name: string }; problem: DigestProblem; dueForMe: boolean }[];
}

/** The weekly digest card. `ai` is true when Gemini wrote the headline and lines. */
export interface GroupDigest {
  headline: string;
  lines: string[];
  pairUp: DigestFacts["pairUp"];
  weekSolves: number;
  ai: boolean;
}
