export type UserRole = 'Admin' | 'Teacher' | 'Student';
export type TeacherStatus = 'Pending' | 'Approved' | 'Rejected';

export interface MeResponse {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
  teacherStatus: TeacherStatus | null;
  teacherDecidedAtUtc: string | null;
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
}

export interface HomeResponse {
  approvedTeacherCount: number;
  lessonCount: number;
  howToJoin: string;
}

export interface TeacherSummary {
  userId: string;
  fullName: string;
  email: string;
  status: TeacherStatus;
  createdAtUtc: string;
  decidedAtUtc: string | null;
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
  lessonOpen: boolean;
  quizOpen: boolean;
  answersOpen: boolean;
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

export interface StudentGradeDetail {
  userId: string;
  fullName: string;
  email: string;
  marks: LessonMark[];
}

export interface ProgressRow {
  studentUserId: string;
  fullName: string;
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
