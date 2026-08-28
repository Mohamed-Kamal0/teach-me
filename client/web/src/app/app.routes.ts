import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { teacherApprovedGuard } from './core/guards/teacher-approved.guard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/public/home.component').then(m => m.HomeComponent) },
  // No guard: the directory is the first thing a visitor with no session can read.
  { path: 'teachers', loadComponent: () => import('./features/public/teachers.component').then(m => m.TeachersComponent) },
  { path: 'login', loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent) },
  { path: 'register/teacher', loadComponent: () => import('./features/auth/register-teacher.component').then(m => m.RegisterTeacherComponent) },
  { path: 'register/student', loadComponent: () => import('./features/auth/register-student.component').then(m => m.RegisterStudentComponent) },

  {
    path: 'admin/approvals',
    canActivate: [roleGuard('Admin')],
    loadComponent: () => import('./features/admin/approvals.component').then(m => m.ApprovalsComponent)
  },

  {
    path: 'admin/profile',
    canActivate: [roleGuard('Admin')],
    loadComponent: () => import('./features/admin/profile.component').then(m => m.AdminProfileComponent)
  },

  {
    path: 'teacher/standing',
    canActivate: [roleGuard('Teacher')],
    loadComponent: () => import('./features/teacher/standing.component').then(m => m.TeacherStandingComponent)
  },
  {
    path: 'teacher/lessons',
    canActivate: [roleGuard('Teacher'), teacherApprovedGuard],
    loadComponent: () => import('./features/teacher/lessons-list.component').then(m => m.LessonsListComponent)
  },
  {
    path: 'teacher/lessons/new',
    canActivate: [roleGuard('Teacher'), teacherApprovedGuard],
    loadComponent: () => import('./features/teacher/lesson-form.component').then(m => m.LessonFormComponent)
  },
  {
    // Declared after 'new', or the literal segment would be read as an :id.
    path: 'teacher/lessons/:id',
    canActivate: [roleGuard('Teacher'), teacherApprovedGuard],
    loadComponent: () => import('./features/teacher/lesson-detail.component').then(m => m.LessonDetailComponent)
  },
  {
    path: 'teacher/lessons/:id/edit',
    canActivate: [roleGuard('Teacher'), teacherApprovedGuard],
    loadComponent: () => import('./features/teacher/lesson-form.component').then(m => m.LessonFormComponent)
  },
  {
    path: 'teacher/students',
    canActivate: [roleGuard('Teacher'), teacherApprovedGuard],
    loadComponent: () => import('./features/teacher/students-list.component').then(m => m.StudentsListComponent)
  },
  {
    path: 'teacher/students/:studentId',
    canActivate: [roleGuard('Teacher'), teacherApprovedGuard],
    loadComponent: () => import('./features/teacher/student-detail.component').then(m => m.StudentDetailComponent)
  },
  {
    path: 'teacher/marks/new',
    canActivate: [roleGuard('Teacher'), teacherApprovedGuard],
    loadComponent: () => import('./features/teacher/marks-new.component').then(m => m.MarksNewComponent)
  },
  {
    path: 'teacher/progress',
    canActivate: [roleGuard('Teacher'), teacherApprovedGuard],
    loadComponent: () => import('./features/teacher/progress.component').then(m => m.ProgressComponent)
  },
  {
    path: 'teacher/profile',
    canActivate: [roleGuard('Teacher')],
    loadComponent: () => import('./features/teacher/profile.component').then(m => m.TeacherProfileComponent)
  },

  {
    path: 'student/profile',
    canActivate: [roleGuard('Student')],
    loadComponent: () => import('./features/student/profile.component').then(m => m.ProfileComponent)
  },
  {
    path: 'student/join',
    canActivate: [roleGuard('Student')],
    loadComponent: () => import('./features/student/join.component').then(m => m.JoinComponent)
  },
  {
    path: 'student/courses',
    canActivate: [roleGuard('Student')],
    loadComponent: () => import('./features/student/courses-list.component').then(m => m.CoursesListComponent)
  },
  {
    path: 'student/courses/:teacherId',
    canActivate: [roleGuard('Student')],
    loadComponent: () => import('./features/student/course-lessons.component').then(m => m.CourseLessonsComponent)
  },
  {
    path: 'student/whats-new',
    canActivate: [roleGuard('Student')],
    loadComponent: () => import('./features/student/whats-new.component').then(m => m.WhatsNewComponent)
  },
  {
    path: 'student/marks',
    canActivate: [roleGuard('Student')],
    loadComponent: () => import('./features/student/marks.component').then(m => m.StudentMarksComponent)
  },

  { path: 'server-down', loadComponent: () => import('./shared/server-down.component').then(m => m.ServerDownComponent) },
  { path: 'not-found', loadComponent: () => import('./shared/not-found.component').then(m => m.NotFoundComponent) },
  { path: '**', loadComponent: () => import('./shared/not-found.component').then(m => m.NotFoundComponent) }
];
