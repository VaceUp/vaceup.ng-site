export interface Choice { id: number; choice_text: string; is_correct?: 'correct' | 'incorrect'; order: number; }
export interface Question { id: number; question_text: string; question_type: 'mcq' | 'true_false' | 'short_answer'; choices: Choice[]; order: number; }
export interface Answer { question_id: number; choice_id: number | null; short_text: string; score_earned?: string | null; }
export interface Attempt { id: number; student_name: string; quiz: number; status: 'in_progress' | 'submitted' | 'graded'; started_at: string; deadline: string; total_score: string | null; passed: boolean; answers: Answer[]; }
export interface Quiz { id: number; course: number; title: string; description: string; course_title: string; status: 'draft' | 'published' | 'completed'; pass_mark: string; time_limit_minutes: number; questions: Question[]; my_attempt?: Attempt | null; }
export interface Assignment { id: number; course: number; title: string; description: string; course_title: string; due_at: string; max_score: string; allow_late_submission: boolean; is_published: boolean; }
export interface Submission { id: number; assignment: number; student_name: string; text_answer: string; file: string | null; status: string; score: string | null; feedback: string; is_late: boolean; submitted_at: string; }
