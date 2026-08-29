export type UserRole = 'Admin' | 'Teacher' | 'Student';
export type TeacherStatus = 'Pending' | 'Approved' | 'Rejected';

export interface MeResponse {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
  teacherStatus: TeacherStatus | null;
  teacherDecidedAtUtc: string | null;
  photoETag: string | null;
  /** What a teacher teaches. Null for everyone else, and for a teacher who registered before
   *  the field existed — which is a real state, not a blank to render. */
  subject: string | null;
  /** How to reach a teacher off the platform. Null for everyone else, and for a teacher who
   *  registered before the field existed. */
  phone: string | null;
}

export interface LoginResponse {
  role: UserRole;
  teacherStatus: TeacherStatus | null;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  errors?: Record<string, string[]>;
  /** True when the request never reached the server — a different fix from any server answer. */
  offline?: boolean;
}

export interface HomeResponse {
  approvedTeacherCount: number;
  lessonCount: number;
  howToJoin: string;
}

export interface TeacherSummary {
  userId: string;
  fullName: string;
  subject: string | null;
  email: string;
  phone: string | null;
  status: TeacherStatus;
  createdAtUtc: string;
  decidedAtUtc: string | null;
  photoETag: string | null;
}

/** A teacher as the public directory shows them: their own aggregates, never a student's.
 *  markCount / passedMarkCount go over the wire separately so the client can render "—" for a
 *  course nobody has sat a quiz on, rather than the server inventing a pass rate for 0/0. */
export interface PublicTeacher {
  userId: string;
  fullName: string;
  subject: string | null;
  /** How to reach the teacher about the course. Null for a teacher who registered before the
   *  field existed — a real state, not a blank to render. */
  phone: string | null;
  photoETag: string | null;
  memberSinceUtc: string;
  openLessonCount: number;
  publishedLessonCount: number;
  studentCount: number;
  markCount: number;
  passedMarkCount: number;
}

export interface Lesson {
  id: string;
  title: string;
  orderIndex: number;
  recordingUrl: string;
  handoutUrl: string | null;
  quizUrl: string | null;
  answersUrl: string | null;
  durationMinutes: number;
  quizMaxScore: number;
  passMark: number;
  opensAtUtc: string | null;
  quizOpensAtUtc: string | null;
  answersOpenAtUtc: string | null;
  // Only the teacher's payload carries these. A student is sent the schedule but not the verdict,
  // because for them the server withholds each URL until its moment — so a URL that is present
  // *is* the verdict. See LessonQueries.cs / StudentLessonDto.cs on the server.
  lessonOpen?: boolean;
  quizOpen?: boolean;
  answersOpen?: boolean;
}

export interface LessonRequest {
  title: string;
  orderIndex: number;
  recordingUrl: string;
  handoutUrl: string | null;
  quizUrl: string | null;
  answersUrl: string | null;
  durationMinutes: number;
  quizMaxScore: number;
  passMark: number;
  opensAtUtc: string | null;
  quizOpensAtUtc: string | null;
  answersOpenAtUtc: string | null;
}

export interface StudentSummary {
  userId: string;
  fullName: string;
  email: string;
  joinedAtUtc: string;
  photoETag: string | null;
}

export interface TeacherStudentsResponse {
  joinCode: string;
  students: PagedResult<StudentSummary>;
}

export interface LessonMark {
  markId: string;
  lessonId: string;
  lessonTitle: string;
  orderIndex: number;
  quizMaxScore: number;
  passMark: number;
  score: number;
  passed: boolean;
  recordedAtUtc: string;
  updatedAtUtc: string | null;
}

export interface StudentProfile {
  userId: string;
  fullName: string;
  displayName: string | null;
  email: string;
  phone: string | null;
  bio: string | null;
  photoETag: string | null;
  joinedAtUtc: string;
  totalLessons: number;
  lessonsMarked: number;
  passedCount: number;
  failedCount: number;
  marks: LessonMark[];
}

export interface ProgressRow {
  studentUserId: string;
  fullName: string;
  photoETag: string | null;
  lessonsMarked: number;
  totalLessons: number;
  passedCount: number;
  failedCount: number;
}

export interface CourseMembership {
  teacherUserId: string;
  teacherFullName: string;
  joinedAtUtc: string;
  lastViewedAtUtc: string | null;
}

export interface Profile {
  userId: string;
  email: string;
  fullName: string;
  displayName: string | null;
  phone: string | null;
  bio: string | null;
  /** A calendar date, `yyyy-MM-dd` — the server's `DateOnly`, with no time and no zone. */
  dateOfBirth: string | null;
  photoETag: string | null;
  courses: CourseMembership[];
}

export interface CourseSummary {
  teacherUserId: string;
  teacherFullName: string;
  joinedAtUtc: string;
  lessonCount: number;
}

export interface StudentLessonWithMark {
  lesson: Lesson;
  score: number | null;
  passed: boolean | null;
}

export interface WhatsNewLessonEntry {
  lessonId: string;
  lessonTitle: string;
  kind: 'lesson' | 'quiz' | 'answers';
}

export interface WhatsNewCourse {
  teacherUserId: string;
  teacherFullName: string;
  welcome: boolean;
  newItems: WhatsNewLessonEntry[];
}

export interface WhatsNewResponse {
  totalNew: number;
  courses: WhatsNewCourse[];
}

export interface StudentMark {
  lessonId: string;
  lessonTitle: string;
  teacherUserId: string;
  teacherFullName: string;
  score: number;
  quizMaxScore: number;
  passMark: number;
  passed: boolean;
  recordedAtUtc: string;
}

export interface HelperAnswer {
  answer?: string;
  route?: string | null;
  unknown?: boolean;
  knownTopics?: string[];
}
